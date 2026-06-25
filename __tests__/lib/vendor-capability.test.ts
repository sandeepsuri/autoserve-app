const mockEq = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn();

function makeBuilder() {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    limit: mockLimit,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
  };
  mockSelect.mockReturnValue(builder);
  mockEq.mockReturnValue(builder);
  mockLimit.mockReturnValue(builder);
  mockOrder.mockReturnValue(builder);
  return builder;
}

let mockIsSupabaseConfigured = false;

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsSupabaseConfigured;
  },
  get supabase() {
    return mockIsSupabaseConfigured ? { from: mockFrom } : null;
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: { getState: jest.fn() },
}));

import { loadVendorCapability } from '@/lib/vendor-capability';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';

const mockAuthGetState = useAuthStore.getState as jest.Mock;
const mockDemoGetState = useDemoDataStore.getState as jest.Mock;

const demoVendor = {
  id: 'vendor-1',
  ownerId: 'vendor-owner-1',
  businessType: 'shop' as const,
  name: 'Riverside Auto Elite',
  description: 'Top-rated diagnostics.',
  address: '482 Riverside Way',
  distanceMiles: 1.4,
  rating: 4.8,
  reviewCount: 124,
  mobileServiceEnabled: true,
  serviceRadiusMiles: 25,
  nextAvailable: 'Tomorrow, 9:30 AM',
  heroImage: 'hero.png',
  serviceCategories: ['tire', 'oil'] as const,
  coordinates: { latitude: 34.0522, longitude: -118.2437 },
};

describe('loadVendorCapability (demo mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured = false;
  });

  it('returns no capability when there is no session', async () => {
    mockAuthGetState.mockReturnValue({ session: null });
    mockDemoGetState.mockReturnValue({ vendors: [], vendorApplications: [] });

    const capability = await loadVendorCapability();

    expect(capability).toEqual({ hasActiveVendor: false });
  });

  it('reports active vendor capability when the owner has a demo vendor row', async () => {
    mockAuthGetState.mockReturnValue({ session: { userId: 'vendor-owner-1', email: 'riverside@autoserve.app' } });
    mockDemoGetState.mockReturnValue({
      vendors: [demoVendor],
      vendorApplications: [{ ownerId: 'vendor-owner-1', status: 'approved' }],
    });

    const capability = await loadVendorCapability();

    expect(capability).toEqual({ hasActiveVendor: true, applicationStatus: 'approved' });
  });

  it('reports applicant status with no active vendor when only an application exists', async () => {
    mockAuthGetState.mockReturnValue({ session: { userId: 'applicant-1', email: 'applicant@autoserve.app' } });
    mockDemoGetState.mockReturnValue({
      vendors: [demoVendor],
      vendorApplications: [{ ownerId: 'applicant-1', status: 'needs_more_info' }],
    });

    const capability = await loadVendorCapability();

    expect(capability).toEqual({ hasActiveVendor: false, applicationStatus: 'needs_more_info' });
  });

  it('returns no capability and no application status for an unrelated user', async () => {
    mockAuthGetState.mockReturnValue({ session: { userId: 'someone-else', email: 'someone@autoserve.app' } });
    mockDemoGetState.mockReturnValue({
      vendors: [demoVendor],
      vendorApplications: [{ ownerId: 'vendor-owner-1', status: 'approved' }],
    });

    const capability = await loadVendorCapability();

    expect(capability).toEqual({ hasActiveVendor: false, applicationStatus: undefined });
  });
});

describe('loadVendorCapability (live Supabase mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured = true;
    mockAuthGetState.mockReturnValue({ session: { userId: 'vendor-owner-1', email: 'riverside@autoserve.app' } });
    mockFrom.mockImplementation(() => makeBuilder());
  });

  it('reports hasActiveVendor: true from the single active row when only one vendor row exists', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'vendor-1', is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { status: 'approved' }, error: null });

    const capability = await loadVendorCapability();

    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(capability).toEqual({ hasActiveVendor: true, applicationStatus: 'approved' });
  });

  it('does not throw and still reports the active vendor when the owner has multiple vendors rows (regression)', async () => {
    // Regression for the "Maximum update depth exceeded" bug: an owner can
    // accumulate more than one `vendors` row across approve/reset SQL
    // cycles (e.g. a deactivated row plus a newly-approved active row).
    // Filtering on `is_active = true` + `limit(1)` means the underlying
    // query builder only ever sees a single matching row here, so
    // `.maybeSingle()` resolves instead of erroring on "multiple rows
    // returned" — which previously made capability silently flip to
    // `hasActiveVendor: false` and ping-pong route-gate redirects.
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'vendor-2-active', is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { status: 'approved' }, error: null });

    await expect(loadVendorCapability()).resolves.toEqual({
      hasActiveVendor: true,
      applicationStatus: 'approved',
    });
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('reports hasActiveVendor: false when the owner has only inactive vendor rows', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { status: 'suspended' }, error: null });

    const capability = await loadVendorCapability();

    expect(capability).toEqual({ hasActiveVendor: false, applicationStatus: 'suspended' });
  });

  it('does not throw when the vendor query itself errors, and treats it as no active vendor', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'unexpected error' } })
      .mockResolvedValueOnce({ data: { status: 'approved' }, error: null });

    await expect(loadVendorCapability()).resolves.toEqual({
      hasActiveVendor: false,
      applicationStatus: 'approved',
    });
  });

  it('uses the most recently updated application row when ordering by updated_at', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { status: 'under_review' }, error: null });

    await loadVendorCapability();

    expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
  });
});
