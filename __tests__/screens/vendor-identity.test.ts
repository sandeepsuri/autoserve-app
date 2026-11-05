import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useVendorIdentity } from '@/lib/use-vendor-identity';

const { act, create } = jest.requireActual('react-test-renderer');
let mockOwner: string | undefined = 'owner-1';
const mockGetVendor = jest.fn();
jest.mock('@/lib/vendor-admin', () => ({ getVendorForOwner: () => mockGetVendor() }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: Object.assign((selector: any) => selector({ session: mockOwner ? { userId: mockOwner } : null }), {
    getState: () => ({ session: mockOwner ? { userId: mockOwner } : null }),
  }),
}));

function Identity() {
  const { data } = useVendorIdentity();
  return React.createElement('identity', { name: data?.name });
}

function pair(client: QueryClient) {
  return React.createElement(QueryClientProvider, { client },
    React.createElement(React.Fragment, null, React.createElement(Identity), React.createElement(Identity)));
}

beforeEach(() => { mockOwner = 'owner-1'; jest.clearAllMocks(); });

test('dashboard/profile consumers share one query and do not reuse another owner’s shop', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  mockGetVendor.mockResolvedValue({ id: 'shop-1', ownerId: 'owner-1', name: 'Published Shop' });
  let screen: any;
  await act(async () => { screen = create(pair(client)); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  expect(screen.root.findAllByType('identity').map((item: any) => item.props.name)).toEqual(['Published Shop', 'Published Shop']);
  expect(mockGetVendor).toHaveBeenCalledTimes(1);

  mockOwner = 'owner-2';
  mockGetVendor.mockResolvedValue(null);
  await act(async () => { screen.update(pair(client)); });
  expect(screen.root.findAllByType('identity').map((item: any) => item.props.name)).toEqual([undefined, undefined]);
  expect(client.getQueryData(['vendor-self', 'owner-1'])).toMatchObject({ name: 'Published Shop' });

  mockOwner = undefined;
  await act(async () => { screen.update(pair(client)); });
  expect(screen.root.findAllByType('identity').map((item: any) => item.props.name)).toEqual([undefined, undefined]);
  await act(async () => { screen.unmount(); });
  client.clear();
});

test('late identity responses after an account switch are discarded', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let finish: (value: any) => void = () => {};
  mockGetVendor.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let screen: any;
  await act(async () => { screen = create(pair(client)); });
  mockOwner = 'owner-2';
  await act(async () => { finish({ id: 'shop-1', ownerId: 'owner-1', name: 'Old Shop' }); });
  expect(client.getQueryData(['vendor-self', 'owner-1'])).toBeNull();
  await act(async () => { screen.unmount(); });
  client.clear();
});
