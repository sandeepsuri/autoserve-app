jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const mockAddVehicle = jest.fn();
const mockUpdateVehicle = jest.fn();
const mockRemoveVehicle = jest.fn();
const mockClearVehicleDefaults = jest.fn();
let mockVehicles: import('@/types/domain').Vehicle[] = [];
let mockAuthState: {
  session: { userId: string; email: string } | null;
  guestMode: boolean;
  guestClientId: string | null;
} = {
  session: { userId: 'client-1', email: 'client@example.com' },
  guestMode: false,
  guestClientId: null,
};

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: {
    getState: () => ({
      get vehicles() {
        return mockVehicles;
      },
      addVehicle: mockAddVehicle,
      updateVehicle: mockUpdateVehicle,
      removeVehicle: mockRemoveVehicle,
      clearVehicleDefaults: mockClearVehicleDefaults,
    }),
  },
}));

import { Vehicle } from '@/types/domain';
import {
  createVehicle,
  getVehicleById,
  listVehicles,
  removeVehicle,
  setDefaultVehicle,
  updateVehicle,
} from '@/lib/vehicles';

const makeVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: `veh-${Math.random().toString(36).slice(2)}`,
  ownerId: 'client-1',
  make: 'Honda',
  model: 'Civic',
  year: '2022',
  isDefault: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVehicles = [];
  mockAuthState = {
    session: { userId: 'client-1', email: 'client@example.com' },
    guestMode: false,
    guestClientId: null,
  };
  mockAddVehicle.mockImplementation((v: Vehicle) => {
    mockVehicles.push(v);
  });
  mockUpdateVehicle.mockImplementation((id: string, patch: Partial<Vehicle>) => {
    mockVehicles = mockVehicles.map((v) => (v.id === id ? { ...v, ...patch } : v));
  });
  mockRemoveVehicle.mockImplementation((id: string) => {
    mockVehicles = mockVehicles.filter((v) => v.id !== id);
  });
  mockClearVehicleDefaults.mockImplementation((ownerId: string) => {
    mockVehicles = mockVehicles.map((v) => (v.ownerId === ownerId ? { ...v, isDefault: false } : v));
  });
});

// ─── listVehicles ─────────────────────────────────────────────────────────────

describe('listVehicles', () => {
  it('returns vehicles for the signed-in owner', async () => {
    mockVehicles = [makeVehicle({ id: 'v1' }), makeVehicle({ id: 'v2' })];
    const result = await listVehicles();
    expect(result).toHaveLength(2);
  });

  it('scopes results to the current owner only', async () => {
    mockVehicles = [
      makeVehicle({ id: 'v1', ownerId: 'client-1' }),
      makeVehicle({ id: 'v2', ownerId: 'client-2' }),
    ];
    const result = await listVehicles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('returns empty array when no session and no guest id', async () => {
    mockAuthState = { session: null, guestMode: false, guestClientId: null };
    const result = await listVehicles();
    expect(result).toHaveLength(0);
  });

  it('returns vehicles for a guest client id', async () => {
    mockAuthState = { session: null, guestMode: true, guestClientId: 'guest-abc' };
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'guest-abc' })];
    const result = await listVehicles();
    expect(result).toHaveLength(1);
  });

  it('returns empty array when client has no vehicles', async () => {
    mockVehicles = [];
    expect(await listVehicles()).toHaveLength(0);
  });
});

// ─── getVehicleById ───────────────────────────────────────────────────────────

describe('getVehicleById', () => {
  it('returns the vehicle when it belongs to the current owner', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'client-1' })];
    const result = await getVehicleById('v1');
    expect(result?.id).toBe('v1');
  });

  it('returns null for a vehicle belonging to another owner', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'client-2' })];
    const result = await getVehicleById('v1');
    expect(result).toBeNull();
  });

  it('returns null when vehicle does not exist', async () => {
    mockVehicles = [];
    const result = await getVehicleById('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── createVehicle ────────────────────────────────────────────────────────────

describe('createVehicle', () => {
  it('creates a vehicle and returns it with a generated id', async () => {
    const result = await createVehicle({ ownerId: 'client-1', make: 'Toyota', model: 'Camry', year: '2021' });
    expect(result.id).toMatch(/^vehicle-/);
    expect(result.make).toBe('Toyota');
    expect(mockAddVehicle).toHaveBeenCalledTimes(1);
  });

  it('persists optional fields: trim, plate, color, photoUrl, nickname', async () => {
    const result = await createVehicle({
      ownerId: 'client-1',
      make: 'Ford',
      model: 'F-150',
      year: '2023',
      trim: 'XLT',
      plate: 'ABC-1234',
      color: 'Blue',
      photoUrl: 'https://example.com/img.jpg',
      nickname: 'Big Blue',
    });
    expect(result.trim).toBe('XLT');
    expect(result.plate).toBe('ABC-1234');
    expect(result.color).toBe('Blue');
    expect(result.photoUrl).toBe('https://example.com/img.jpg');
    expect(result.nickname).toBe('Big Blue');
  });

  it('clears other defaults before setting a new default', async () => {
    mockVehicles = [makeVehicle({ id: 'v-old', ownerId: 'client-1', isDefault: true })];
    await createVehicle({ ownerId: 'client-1', make: 'BMW', model: '3 Series', year: '2020', isDefault: true });
    expect(mockClearVehicleDefaults).toHaveBeenCalledWith('client-1');
  });

  it('does not clear defaults when isDefault is false', async () => {
    await createVehicle({ ownerId: 'client-1', make: 'Kia', model: 'Soul', year: '2019', isDefault: false });
    expect(mockClearVehicleDefaults).not.toHaveBeenCalled();
  });

  it('throws when no session and no guest id', async () => {
    mockAuthState = { session: null, guestMode: false, guestClientId: null };
    await expect(
      createVehicle({ ownerId: '', make: 'X', model: 'Y', year: '2020' })
    ).rejects.toThrow('Sign in required');
  });
});

// ─── updateVehicle ────────────────────────────────────────────────────────────

describe('updateVehicle', () => {
  it('applies a partial patch to an existing vehicle', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', make: 'Honda', color: undefined })];
    const result = await updateVehicle('v1', { color: 'Red' });
    expect(result.color).toBe('Red');
    expect(mockUpdateVehicle).toHaveBeenCalledWith('v1', { color: 'Red' });
  });

  it('clears other defaults before promoting a new default', async () => {
    mockVehicles = [
      makeVehicle({ id: 'v1', ownerId: 'client-1', isDefault: true }),
      makeVehicle({ id: 'v2', ownerId: 'client-1', isDefault: false }),
    ];
    await updateVehicle('v2', { isDefault: true });
    expect(mockClearVehicleDefaults).toHaveBeenCalledWith('client-1');
  });

  it('throws when vehicle is not found after update', async () => {
    mockVehicles = [];
    await expect(updateVehicle('nonexistent', { color: 'Green' })).rejects.toThrow('Vehicle not found');
  });

  it('throws when not signed in', async () => {
    mockAuthState = { session: null, guestMode: false, guestClientId: null };
    await expect(updateVehicle('v1', { color: 'Blue' })).rejects.toThrow('Sign in required');
  });
});

// ─── removeVehicle ────────────────────────────────────────────────────────────

describe('removeVehicle', () => {
  it('removes the vehicle from the store', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'client-1' })];
    await removeVehicle('v1');
    expect(mockRemoveVehicle).toHaveBeenCalledWith('v1');
  });

  it('promotes another vehicle to default when the removed vehicle was default', async () => {
    mockVehicles = [
      makeVehicle({ id: 'v1', ownerId: 'client-1', isDefault: true }),
      makeVehicle({ id: 'v2', ownerId: 'client-1', isDefault: false }),
    ];
    mockRemoveVehicle.mockImplementationOnce((id: string) => {
      mockVehicles = mockVehicles.filter((v) => v.id !== id);
    });
    await removeVehicle('v1');
    expect(mockUpdateVehicle).toHaveBeenCalledWith('v2', { isDefault: true });
  });

  it('does not promote a default when no other vehicles remain', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'client-1', isDefault: true })];
    mockRemoveVehicle.mockImplementationOnce((id: string) => {
      mockVehicles = mockVehicles.filter((v) => v.id !== id);
    });
    await removeVehicle('v1');
    expect(mockUpdateVehicle).not.toHaveBeenCalled();
  });

  it('does nothing when the vehicle belongs to a different owner', async () => {
    mockVehicles = [makeVehicle({ id: 'v1', ownerId: 'client-2' })];
    await removeVehicle('v1');
    expect(mockRemoveVehicle).not.toHaveBeenCalled();
  });

  it('throws when not signed in', async () => {
    mockAuthState = { session: null, guestMode: false, guestClientId: null };
    await expect(removeVehicle('v1')).rejects.toThrow('Sign in required');
  });
});

// ─── setDefaultVehicle ────────────────────────────────────────────────────────

describe('setDefaultVehicle', () => {
  it('sets isDefault on the target and clears others', async () => {
    mockVehicles = [
      makeVehicle({ id: 'v1', ownerId: 'client-1', isDefault: true }),
      makeVehicle({ id: 'v2', ownerId: 'client-1', isDefault: false }),
    ];
    await setDefaultVehicle('v2');
    expect(mockClearVehicleDefaults).toHaveBeenCalledWith('client-1');
    expect(mockUpdateVehicle).toHaveBeenCalledWith('v2', { isDefault: true });
  });
});

// ─── client scoping ───────────────────────────────────────────────────────────

describe('client scoping', () => {
  it('owner A cannot see owner B vehicles via listVehicles', async () => {
    mockVehicles = [
      makeVehicle({ id: 'v-a', ownerId: 'client-1' }),
      makeVehicle({ id: 'v-b', ownerId: 'client-2' }),
    ];
    const result = await listVehicles();
    expect(result.map((v) => v.id)).toEqual(['v-a']);
  });

  it('owner A cannot retrieve owner B vehicle via getVehicleById', async () => {
    mockVehicles = [makeVehicle({ id: 'v-b', ownerId: 'client-2' })];
    const result = await getVehicleById('v-b');
    expect(result).toBeNull();
  });
});
