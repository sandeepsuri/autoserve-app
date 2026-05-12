jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: { getState: jest.fn(() => ({ vendors: [] })) },
  demoReviewsState: [],
}));

jest.mock('@/constants/mock-data', () => ({
  availabilityByVendor: {},
}));

import { VendorSummary } from '@/types/domain';
import { listVendors } from '@/lib/vendors';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase!.from as jest.Mock;

const makeVendor = (overrides: Partial<VendorSummary> = {}): VendorSummary => ({
  id: 'v1',
  ownerId: 'o1',
  businessType: 'shop',
  name: 'Test Shop',
  description: 'Great service',
  address: '123 Main St',
  distanceMiles: 2,
  rating: 4.5,
  reviewCount: 10,
  mobileServiceEnabled: true,
  serviceRadiusMiles: 20,
  nextAvailable: 'Tomorrow',
  heroImage: undefined,
  serviceCategories: ['oil', 'tire'],
  coordinates: { latitude: 34.05, longitude: -118.24 },
  ...overrides,
});

const toDbRow = (v: VendorSummary) => ({
  id: v.id,
  owner_id: v.ownerId,
  business_type: v.businessType,
  name: v.name,
  description: v.description,
  address: v.address,
  distance_miles: v.distanceMiles,
  rating: v.rating,
  review_count: v.reviewCount,
  mobile_service_enabled: v.mobileServiceEnabled,
  service_radius_miles: v.serviceRadiusMiles,
  next_available: v.nextAvailable,
  hero_image: v.heroImage ?? null,
  service_categories: v.serviceCategories,
  latitude: v.coordinates.latitude,
  longitude: v.coordinates.longitude,
});

const mockSupabaseRows = (vendors: VendorSummary[]) => {
  mockFrom.mockReturnValue({
    select: jest.fn().mockResolvedValue({ data: vendors.map(toDbRow), error: null }),
  });
};

beforeEach(() => jest.clearAllMocks());

// ─── filtering ───────────────────────────────────────────────────────────────

describe('listVendors — filtering', () => {
  it('returns all vendors when no filters are active', async () => {
    mockSupabaseRows([makeVendor({ id: 'v1' }), makeVendor({ id: 'v2' })]);
    expect(await listVendors()).toHaveLength(2);
  });

  it('mobileOnly: true excludes vendors without mobile service', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', mobileServiceEnabled: true }),
      makeVendor({ id: 'v2', mobileServiceEnabled: false }),
    ]);
    const result = await listVendors({ mobileOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('mobileOnly: false includes all vendors regardless of mobile flag', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', mobileServiceEnabled: true }),
      makeVendor({ id: 'v2', mobileServiceEnabled: false }),
    ]);
    expect(await listVendors({ mobileOnly: false })).toHaveLength(2);
  });

  it('minimumRating filters out vendors below the threshold', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', rating: 4.8 }),
      makeVendor({ id: 'v2', rating: 3.9 }),
    ]);
    const result = await listVendors({ minimumRating: 4.5 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('query filters by vendor name (case-insensitive)', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', name: 'Riverside Auto Elite' }),
      makeVendor({ id: 'v2', name: 'Precision Care' }),
    ]);
    const result = await listVendors({ query: 'riverside' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('query filters by description when name does not match', async () => {
    mockSupabaseRows([makeVendor({ name: 'Shop A', description: 'European specialist' })]);
    expect(await listVendors({ query: 'european' })).toHaveLength(1);
  });

  it('maxDistanceMiles excludes vendors beyond the limit', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', distanceMiles: 5 }),
      makeVendor({ id: 'v2', distanceMiles: 35 }),
    ]);
    const result = await listVendors({ maxDistanceMiles: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('combined filters apply intersection logic', async () => {
    mockSupabaseRows([
      makeVendor({ id: 'v1', mobileServiceEnabled: true, rating: 4.9, distanceMiles: 1 }),
      makeVendor({ id: 'v2', mobileServiceEnabled: true, rating: 3.5, distanceMiles: 1 }),
      makeVendor({ id: 'v3', mobileServiceEnabled: false, rating: 4.9, distanceMiles: 1 }),
    ]);
    const result = await listVendors({ mobileOnly: true, minimumRating: 4.5 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v1');
  });

  it('returns empty array when no vendors match filters', async () => {
    mockSupabaseRows([makeVendor({ rating: 3.0 })]);
    expect(await listVendors({ minimumRating: 5.0 })).toHaveLength(0);
  });

  it('returns empty array when Supabase returns no rows', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    expect(await listVendors()).toHaveLength(0);
  });
});

// ─── DB field mapping ─────────────────────────────────────────────────────────

describe('listVendors — snake_case to camelCase mapping', () => {
  it('maps DB row fields to VendorSummary correctly', async () => {
    mockSupabaseRows([makeVendor({ distanceMiles: 1.4, rating: 4.8, reviewCount: 124 })]);
    const [v] = await listVendors();
    expect(v.distanceMiles).toBe(1.4);
    expect(v.rating).toBe(4.8);
    expect(v.reviewCount).toBe(124);
    expect(v.mobileServiceEnabled).toBe(true);
    expect(v.coordinates).toEqual({ latitude: 34.05, longitude: -118.24 });
  });
});
