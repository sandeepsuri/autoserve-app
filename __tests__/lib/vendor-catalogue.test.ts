import { requiredText, sanitizeTextInput } from '@/lib/validation';
import { getVendorForOwner, listVendorServices, upsertVendorService } from '@/lib/vendor-admin';
import { Service } from '@/types/domain';

let mockOwner: string | undefined = 'owner-1';
let mockVendor = { id: 'vendor-1', owner_id: 'owner-1', is_active: true, name: 'Published Shop' };
let mockRows: Record<string, any>[] = [];
const mockOrders = jest.fn();
const mockWrites = jest.fn();
let mockFinishVendorRead: (() => void) | undefined;

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ session: mockOwner ? { userId: mockOwner } : null }) },
}));
jest.mock('@/store/useDemoDataStore', () => ({ useDemoDataStore: { getState: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table: string) => mockBuilder(table) },
}));

// Model a server whose physical row order changes on updates. Only ORDER BY
// establishes catalogue order; constructing a new builder models a fresh read.
function mockBuilder(table: string) {
  const filters: [string, unknown][] = [];
  const orders: string[] = [];
  const builder: any = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
    order: (key: string) => { orders.push(key); mockOrders(table, key); return builder; },
    limit: () => builder,
    maybeSingle: async () => {
      mockFinishVendorRead?.();
      return { data: mockVendor, error: null };
    },
    upsert: async (payload: Record<string, any>) => {
      mockWrites(payload);
      const old = mockRows.find((row) => row.id === payload.id);
      mockRows = [...mockRows.filter((row) => row.id !== payload.id), { ...old, ...payload }];
      return { error: null };
    },
    insert: (payload: Record<string, any>) => {
      mockWrites(payload);
      const row = { ...payload, id: '11111111-1111-4111-8111-111111111114', catalogue_order: 4 };
      mockRows.push(row);
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
    },
    then: (resolve: (value: unknown) => void) => {
      const rows = mockRows.filter((row) => filters.every(([key, value]) => row[key] === value));
      rows.sort((a, b) => {
        for (const key of orders) {
          if (a[key] < b[key]) return -1;
          if (a[key] > b[key]) return 1;
        }
        return 0;
      });
      resolve({ data: rows, error: null });
    },
  };
  return builder;
}

const service = (n: number): Service => ({
  id: `11111111-1111-4111-8111-11111111111${n}`, vendorId: 'vendor-1',
  title: `Service ${n}`, category: 'oil', price: 40, durationMinutes: 30, active: true, bookingEligibility: 'both',
  description: 'Keep these details', image: 'service.jpg',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOwner = 'owner-1';
  mockVendor = { id: 'vendor-1', owner_id: 'owner-1', is_active: true, name: 'Published Shop' };
  mockFinishVendorRead = undefined;
  mockRows = [1, 2, 3].map((n) => ({
    id: service(n).id, vendor_id: 'vendor-1', title: service(n).title,
    category: 'oil', price: 40, duration_minutes: 30, active: true, catalogue_order: n,
  }));
});

test('typing word by word retains spaces; validation trims only the outside', () => {
  let typed = '';
  for (const character of '  Full  Synthetic Oil Change  ') {
    typed = sanitizeTextInput(typed + character, 60);
  }
  expect(typed).toBe('  Full  Synthetic Oil Change  ');
  expect(requiredText('Title', { min: 2, max: 60 }).parse(typed)).toBe('Full  Synthetic Oil Change');
  expect(sanitizeTextInput('<Oil>\u0000 Change')).toBe('Oil Change');
});

test('successive title, price, duration, and active edits retain persisted order on fresh reads', async () => {
  const ids = (await listVendorServices()).map((s) => s.id);
  for (const n of [1, 3, 2, 1]) {
    await upsertVendorService({ ...service(n), title: '  Full  Synthetic Oil Change  ', price: 90 + n, durationMinutes: 60, active: false });
    const refreshed = await listVendorServices();
    expect(refreshed.map((s) => s.id)).toEqual(ids);
    expect(refreshed.find((s) => s.id === service(n).id)?.title).toBe('Full  Synthetic Oil Change');
  }
  expect(mockOrders).toHaveBeenCalledWith('services', 'catalogue_order');
  expect(mockOrders).toHaveBeenCalledWith('services', 'id');
  for (const [payload] of mockWrites.mock.calls) expect(payload).not.toHaveProperty('catalogue_order');
});

test('new services omit order so the database allocates an append position', async () => {
  await upsertVendorService({ ...service(4), id: 'new-service', title: '  Oil  Change  ' });
  expect((await listVendorServices()).map((s) => s.title)).toEqual(['Service 1', 'Service 2', 'Service 3', 'Oil  Change']);
  expect(mockWrites.mock.calls[0][0]).not.toHaveProperty('catalogue_order');
});

test('published identity belongs to the current owner', async () => {
  expect((await getVendorForOwner())?.name).toBe('Published Shop');
  mockVendor.owner_id = 'other-owner';
  expect(await getVendorForOwner()).toBeNull();
});

test('inactive shops and signed-out sessions do not provide an identity', async () => {
  mockVendor.is_active = false;
  expect(await getVendorForOwner()).toBeNull();
  mockOwner = undefined;
  expect(await getVendorForOwner()).toBeNull();
  expect(await listVendorServices()).toEqual([]);
});

test('an owner change during a request discards the old identity', async () => {
  mockFinishVendorRead = () => { mockOwner = 'owner-2'; };
  expect(await getVendorForOwner()).toBeNull();
});

test('eligibility survives a vendor edit, a pause, and a fresh read', async () => {
  const [first] = await listVendorServices();
  expect(first.bookingEligibility).toBe('both');
  await upsertVendorService({ ...first, bookingEligibility: 'shop' });
  expect(mockWrites).toHaveBeenLastCalledWith(expect.objectContaining({ booking_eligibility: 'shop' }));

  // Pausing saves the mapped read, so the field must round-trip through it.
  const edited = (await listVendorServices()).find((row) => row.id === first.id)!;
  expect(edited.bookingEligibility).toBe('shop');
  await upsertVendorService({ ...edited, active: false });
  expect(mockWrites).toHaveBeenLastCalledWith(expect.objectContaining({ active: false, booking_eligibility: 'shop' }));
  expect((await listVendorServices()).find((row) => row.id === first.id)?.bookingEligibility).toBe('shop');
});

test('a new service persists its eligibility and returns it', async () => {
  const saved = await upsertVendorService({ ...service(9), id: 'service-new', bookingEligibility: 'mobile' });
  expect(mockWrites).toHaveBeenLastCalledWith(expect.objectContaining({ booking_eligibility: 'mobile' }));
  expect(saved.bookingEligibility).toBe('mobile');
});
