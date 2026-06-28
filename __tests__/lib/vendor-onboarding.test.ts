let mockIsSupabaseConfigured = false;
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsSupabaseConfigured;
  },
  get supabase() {
    return mockIsSupabaseConfigured ? { from: mockFrom, rpc: mockRpc } : null;
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: { getState: jest.fn() },
}));

import {
  isVendorApplicationEditable,
  loadVendorOnboardingDraft,
  saveVendorOnboardingDraft,
  submitVendorOnboarding,
} from '@/lib/vendor-onboarding';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

const mockAuthGetState = useAuthStore.getState as jest.Mock;
const mockDemoGetState = useDemoDataStore.getState as jest.Mock;
const mockSetSessionData = jest.fn();
const baseApplicationRow = {
  id: 'application-1',
  owner_id: 'vendor-owner-1',
  status: 'needs_more_info' as const,
  business_type: 'shop' as const,
  business_name: 'Riverside Garage',
  business_description: 'General repair and maintenance.',
  contact_name: 'Alex Rivers',
  contact_email: 'riverside@autoserve.app',
  contact_phone: '+1 310 555 0101',
  location_mode: 'hybrid' as const,
  address: '482 Riverside Way',
  latitude: 34.0522,
  longitude: -118.2437,
  service_radius_miles: 30,
  service_catalog: [
    {
      id: 'service-1',
      title: 'Brake Check',
      category: 'brakes',
      description: 'Inspection and recommendations.',
      durationMinutes: 40,
      price: 55,
      active: true,
    },
  ],
  submitted_at: '2026-06-23T00:00:00.000Z',
  reviewer_notes: 'Please upload current insurance and confirm your service radius.',
  updated_at: '2026-06-24T00:00:00.000Z',
};

const demoState = {
  profiles: [],
  vendors: [
    {
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
    },
  ],
  services: [
    {
      id: 'service-1',
      vendorId: 'vendor-1',
      title: 'Tire Change',
      category: 'tire' as const,
      description: 'Swap and balance.',
      durationMinutes: 45,
      price: 85,
      active: true,
    },
  ],
  onboardingDrafts: [] as Array<{ ownerId: string }>,
  vendorApplications: [] as any[],
  addOrUpdateProfile: jest.fn(),
  addVehicle: jest.fn(),
  addBooking: jest.fn(),
  updateBookingStatus: jest.fn(),
  upsertService: jest.fn(),
  removeService: jest.fn(),
  updateVendor: jest.fn(),
  upsertVendor: jest.fn(),
  saveOnboardingDraft: jest.fn((draft) => {
    const index = demoState.onboardingDrafts.findIndex((item: { ownerId: string }) => item.ownerId === draft.ownerId);
    if (index >= 0) {
      demoState.onboardingDrafts[index] = draft;
    } else {
      demoState.onboardingDrafts.push(draft);
    }
  }),
  saveVendorApplication: jest.fn((application) => {
    const index = demoState.vendorApplications.findIndex((item: { ownerId: string }) => item.ownerId === application.ownerId);
    if (index >= 0) {
      demoState.vendorApplications[index] = application;
    } else {
      demoState.vendorApplications.push(application);
    }
  }),
  saveVendorAvailability: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsSupabaseConfigured = false;
  mockFrom.mockReset();
  mockRpc.mockReset();
  demoState.onboardingDrafts = [];
  demoState.vendorApplications = [];
  useVendorOnboardingStore.getState().reset();
  mockAuthGetState.mockReturnValue({
    session: { userId: 'vendor-owner-1', email: 'riverside@autoserve.app' },
    profile: {
      id: 'vendor-owner-1',
      email: 'riverside@autoserve.app',
      fullName: 'Alex Rivers',
      phone: '+1 310 555 0101',
      role: 'vendor',
      businessType: 'shop',
    },
    setSessionData: mockSetSessionData,
  });
  mockDemoGetState.mockImplementation(() => demoState);
});

function mockLiveSupabase(applicationRow = baseApplicationRow) {
  const profilesUpsert = jest.fn().mockResolvedValue({ error: null });
  const applicationsUpsert = jest.fn().mockResolvedValue({ error: null });
  const applicationsMaybeSingle = jest.fn().mockResolvedValue({ data: applicationRow, error: null });
  const vendorsMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { upsert: profilesUpsert };
    }
    if (table === 'vendor_applications') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: applicationsMaybeSingle }),
        }),
        upsert: applicationsUpsert,
      };
    }
    if (table === 'vendors') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: vendorsMaybeSingle }),
        }),
      };
    }
    return {};
  });

  mockRpc.mockResolvedValue({
    data: { ...applicationRow, status: 'submitted', reviewer_notes: null },
    error: null,
  });

  return {
    applicationsMaybeSingle,
    applicationsUpsert,
    profilesUpsert,
    vendorsMaybeSingle,
  };
}

describe('vendor onboarding draft service', () => {
  it('treats only draft and needs_more_info applications as editable', () => {
    expect(isVendorApplicationEditable(undefined)).toBe(true);
    expect(isVendorApplicationEditable('draft')).toBe(true);
    expect(isVendorApplicationEditable('needs_more_info')).toBe(true);
    expect(isVendorApplicationEditable('submitted')).toBe(false);
    expect(isVendorApplicationEditable('under_review')).toBe(false);
  });

  it('derives a draft from existing vendor and service state when no saved draft exists', async () => {
    const draft = await loadVendorOnboardingDraft();

    expect(draft.businessType).toBe('shop');
    expect(draft.profile.businessName).toBe('Riverside Auto Elite');
    expect(draft.profile.contactName).toBe('Alex Rivers');
    expect(draft.location.mode).toBe('hybrid');
    expect(draft.services).toHaveLength(1);
    expect(draft.services[0]).toEqual(
      expect.objectContaining({
        id: 'service-1',
        title: 'Tire Change',
        description: 'Swap and balance.',
      }),
    );
  });

  it('merges and persists partial draft updates in demo mode', async () => {
    const draft = await saveVendorOnboardingDraft({
      profile: { businessName: 'Riverside Garage' },
      location: { mode: 'fixed', address: '500 New Address' },
    });

    expect(draft.profile.businessName).toBe('Riverside Garage');
    expect(draft.location.mode).toBe('fixed');
    expect(draft.location.address).toBe('500 New Address');
    expect(demoState.saveOnboardingDraft).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'vendor-owner-1',
      profile: expect.objectContaining({ businessName: 'Riverside Garage' }),
    }));
  });

  it('rejects final submission when required onboarding fields are missing', async () => {
    await expect(
      submitVendorOnboarding({
        businessType: 'solo',
        profile: {
          businessName: 'Solo Mechanic',
          contactName: 'Sam Tech',
          contactEmail: 'sam@example.com',
          contactPhone: '+1 310 555 0111',
        },
        location: {
          mode: 'mobile',
          address: 'Base address',
          coordinates: { latitude: 34.05, longitude: -118.24 },
        },
        services: [],
      }),
    ).rejects.toThrow('Vendor onboarding submission invalid');
  });

  it('submits a valid application without publishing a live vendor in demo mode', async () => {
    const draft = await submitVendorOnboarding({
      businessType: 'shop',
      profile: {
        businessName: 'Riverside Garage',
        description: 'General repair and maintenance.',
        contactName: 'Alex Rivers',
        contactEmail: 'riverside@autoserve.app',
        contactPhone: '+1 310 555 0101',
      },
      location: {
        mode: 'hybrid',
        address: '482 Riverside Way',
        coordinates: { latitude: 34.0522, longitude: -118.2437 },
        serviceRadiusMiles: 30,
      },
      services: [
        {
          id: 'service-1',
          title: 'Brake Check',
          category: 'brakes',
          description: 'Inspection and recommendations.',
          durationMinutes: 40,
          price: 55,
          active: true,
        },
      ],
    });

    expect(draft.completed).toBe(true);
    expect(draft.submittedAt).toBeDefined();
    expect(draft.applicationStatus).toBe('submitted');
    expect(demoState.saveVendorApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'vendor-owner-1',
        status: 'submitted',
        profile: expect.objectContaining({ businessName: 'Riverside Garage' }),
      }),
    );
    expect(demoState.addOrUpdateProfile).not.toHaveBeenCalled();
    expect(demoState.upsertVendor).not.toHaveBeenCalled();
    expect(mockSetSessionData).not.toHaveBeenCalled();
  });

  it('does not resubmit or save a locked submitted application', async () => {
    demoState.vendorApplications = [
      {
        id: 'application-1',
        ownerId: 'vendor-owner-1',
        status: 'submitted',
        businessType: 'shop',
        profile: {
          businessName: 'Riverside Garage',
          description: 'General repair and maintenance.',
          contactName: 'Alex Rivers',
          contactEmail: 'riverside@autoserve.app',
          contactPhone: '+1 310 555 0101',
        },
        location: {
          mode: 'hybrid',
          address: '482 Riverside Way',
          coordinates: { latitude: 34.0522, longitude: -118.2437 },
          serviceRadiusMiles: 30,
        },
        services: [
          {
            id: 'service-1',
            title: 'Brake Check',
            category: 'brakes',
            description: 'Inspection and recommendations.',
            durationMinutes: 40,
            price: 55,
            active: true,
          },
        ],
        submittedAt: '2026-06-23T00:00:00.000Z',
        updatedAt: '2026-06-23T00:00:00.000Z',
      },
    ];

    const draft = await submitVendorOnboarding();

    expect(draft.applicationStatus).toBe('submitted');
    expect(draft.submittedAt).toBe('2026-06-23T00:00:00.000Z');
    expect(demoState.saveOnboardingDraft).not.toHaveBeenCalled();
    expect(demoState.saveVendorApplication).not.toHaveBeenCalled();
  });

  it('threads reviewer_notes into reviewerNotes in live mode', async () => {
    mockIsSupabaseConfigured = true;
    mockLiveSupabase();

    const draft = await loadVendorOnboardingDraft();

    expect(draft.reviewerNotes).toBe('Please upload current insurance and confirm your service radius.');
    expect(draft.applicationStatus).toBe('needs_more_info');
  });

  it('resubmits a needs_more_info application through submit_vendor_application in live mode', async () => {
    mockIsSupabaseConfigured = true;
    const { applicationsUpsert } = mockLiveSupabase();

    const draft = await submitVendorOnboarding();

    expect(applicationsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'vendor-owner-1',
      business_name: 'Riverside Garage',
    }), { onConflict: 'owner_id' });
    expect(mockRpc).toHaveBeenCalledWith('submit_vendor_application');
    expect(draft.applicationStatus).toBe('submitted');
  });
});
