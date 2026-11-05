import { QueryClient } from '@tanstack/react-query';

import { listVehicleMakes, listVehicleModels, listVehicleYears } from '@/lib/vehicle-catalog';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const originalDev = __DEV__;
const fetchMock = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://preview-api.example.com/';
  Object.assign(global, { __DEV__: false, fetch: fetchMock });
  fetchMock.mockReset();
});
afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  Object.assign(global, { __DEV__: originalDev, fetch: originalFetch });
  jest.useRealTimers();
});

const steps = [
  { step: 'makes', load: listVehicleMakes, query: '' },
  { step: 'models', load: () => listVehicleModels('Land Rover'), query: '?make=Land+Rover' },
  { step: 'years', load: () => listVehicleYears('Land Rover', 'Range Rover & Sport'), query: '?make=Land+Rover&model=Range+Rover+%26+Sport' },
];

describe.each(steps)('$step catalog', ({ step, load, query }) => {
  it('requests the configured preview API and returns options', async () => {
    const items = [{ label: step === 'years' ? '2024' : 'Example', path: '/example' }];
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await expect(load()).resolves.toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith(`https://preview-api.example.com/api/v1/vehicle-selection/${step}${query}`, expect.objectContaining({ signal: expect.anything() }));
  });

  it('exposes failure and supports retry of the same query', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = { queryKey: ['catalog', step], queryFn: load };
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(client.fetchQuery(options)).rejects.toThrow(/503.*try again/);
    expect(client.getQueryState(options.queryKey)?.status).toBe('error');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ label: 'Example', path: '/example' }] }) });
    await expect(client.fetchQuery(options)).resolves.toHaveLength(1);
    expect(client.getQueryState(options.queryKey)?.status).toBe('success');
    client.clear();
  });

  it('provides actionable network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(load()).rejects.toThrow(/Check your connection and try again/);
  });

  it.each([{}, { items: null }, { items: [{ name: 'wrong' }] }])('rejects malformed payloads: %p', async (body) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => body });
    await expect(load()).rejects.toThrow(/invalid/);
  });

  it('returns an empty catalog as an empty list', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await expect(load()).resolves.toEqual([]);
  });
});

it('does not fetch a relative or localhost URL when release configuration is missing', async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  await expect(listVehicleMakes()).rejects.toThrow('EXPO_PUBLIC_API_BASE_URL');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('aborts a stalled request with an actionable timeout', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const request = expect(listVehicleMakes()).rejects.toThrow(/timed out.*try again/);
  await jest.advanceTimersByTimeAsync(15000);
  await request;
});
