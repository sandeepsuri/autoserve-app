type SupabaseResponse<T> = { data: T | null; error: { message?: string } | null };

const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
var mockFrom = jest.fn();

function mockSupabaseFrom(...args: unknown[]) {
  return mockFrom(...args);
}

let mockAuthState = {
  session: { userId: 'client-1', email: 'client@example.com' } as { userId: string; email: string } | null,
  guestMode: false,
  guestClientId: null as string | null,
};

function makeBuilder() {
  const builder = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };
  mockSelect.mockReturnValue(builder);
  mockInsert.mockReturnValue(builder);
  mockUpdate.mockReturnValue(builder);
  mockDelete.mockReturnValue(builder);
  mockEq.mockReturnValue(builder);
  return builder;
}

function vehicleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vehicle-1',
    owner_id: 'client-1',
    make: 'Honda',
    model: 'Civic',
    year: '2022',
    trim: null,
    plate: null,
    color: null,
    photo_url: null,
    nickname: null,
    is_default: false,
    ...overrides,
  };
}

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: mockSupabaseFrom,
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: {
    getState: () => ({
      vehicles: [],
      addVehicle: jest.fn(),
      updateVehicle: jest.fn(),
      removeVehicle: jest.fn(),
      clearVehicleDefaults: jest.fn(),
    }),
  },
}));

import { createVehicle, getVehicleById, listVehicles, updateVehicle } from '@/lib/vehicles';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = {
    session: { userId: 'client-1', email: 'client@example.com' },
    guestMode: false,
    guestClientId: null,
  };

  const builder = makeBuilder();
  mockFrom.mockReturnValue(builder);
});

describe('vehicles Supabase persistence', () => {
  it('lists vehicles from Supabase for the signed-in owner', async () => {
    const rows = [vehicleRow({ id: 'vehicle-1' }), vehicleRow({ id: 'vehicle-2', model: 'Accord' })];
    mockOrder.mockResolvedValueOnce({ data: rows, error: null } satisfies SupabaseResponse<typeof rows>);

    const result = await listVehicles();

    expect(mockFrom).toHaveBeenCalledWith('vehicles');
    expect(mockEq).toHaveBeenCalledWith('owner_id', 'client-1');
    expect(result.map((v) => v.id)).toEqual(['vehicle-1', 'vehicle-2']);
  });

  it('surfaces Supabase list errors instead of falling back to demo data', async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation "vehicles" does not exist' },
    } satisfies SupabaseResponse<unknown[]>);

    await expect(listVehicles()).rejects.toThrow('relation "vehicles" does not exist');
  });

  it('inserts a vehicle into Supabase and returns the created row', async () => {
    const inserted = vehicleRow({
      id: '9cc5b088-8b4a-44fa-9e55-b2d360f7be54',
      make: 'Toyota',
      model: 'Camry',
      year: '2021',
      is_default: true,
    });
    mockEq.mockReturnValue(makeBuilder());
    mockSingle.mockResolvedValueOnce({ data: inserted, error: null } satisfies SupabaseResponse<typeof inserted>);

    const result = await createVehicle({
      ownerId: 'client-1',
      make: 'Toyota',
      model: 'Camry',
      year: '2021',
      isDefault: true,
    });

    expect(mockUpdate).toHaveBeenCalledWith({ is_default: false });
    expect(mockInsert).toHaveBeenCalledWith({
      owner_id: 'client-1',
      make: 'Toyota',
      model: 'Camry',
      year: '2021',
      trim: null,
      plate: null,
      color: null,
      photo_url: null,
      nickname: null,
      is_default: true,
    });
    expect(result.id).toBe('9cc5b088-8b4a-44fa-9e55-b2d360f7be54');
    expect(result.isDefault).toBe(true);
  });

  it('surfaces Supabase insert errors', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    } satisfies SupabaseResponse<unknown>);

    await expect(
      createVehicle({ ownerId: 'client-1', make: 'Ford', model: 'F-150', year: '2023' }),
    ).rejects.toThrow('new row violates row-level security policy');
  });

  it('scopes get and update calls by owner_id', async () => {
    const updated = vehicleRow({ id: 'vehicle-1', color: 'Blue' });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: vehicleRow({ id: 'vehicle-1' }), error: null } satisfies SupabaseResponse<unknown>)
      .mockResolvedValueOnce({ data: updated, error: null } satisfies SupabaseResponse<typeof updated>);

    await getVehicleById('vehicle-1');
    await updateVehicle('vehicle-1', { color: 'Blue' });

    expect(mockEq).toHaveBeenCalledWith('id', 'vehicle-1');
    expect(mockEq).toHaveBeenCalledWith('owner_id', 'client-1');
    expect(mockUpdate).toHaveBeenCalledWith({ color: 'Blue' });
  });
});
