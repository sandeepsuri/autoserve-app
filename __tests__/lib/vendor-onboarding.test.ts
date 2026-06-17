jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: { getState: jest.fn() },
}));

import {
  loadVendorOnboardingDraft,
  saveVendorOnboardingDraft,
  submitVendorOnboarding,
} from '@/lib/vendor-onboarding';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';

const mockAuthGetState = useAuthStore.getState as jest.Mock;
const mockDemoGetState = useDemoDataStore.getState as jest.Mock;
const mockSetSessionData = jest.fn();

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
  saveVendorAvailability: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  demoState.onboardingDrafts = [];
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

describe('vendor onboarding draft service', () => {
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

  it('submits a valid draft and syncs demo profile, vendor, and services', async () => {
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
    expect(demoState.addOrUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vendor-owner-1',
        role: 'vendor',
        businessType: 'shop',
      }),
    );
    expect(demoState.upsertVendor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vendor-1',
        name: 'Riverside Garage',
        mobileServiceEnabled: true,
        serviceRadiusMiles: 30,
      }),
    );
    expect(demoState.removeService).toHaveBeenCalledWith('service-1');
    expect(demoState.upsertService).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: 'vendor-1',
        title: 'Brake Check',
        category: 'brakes',
      }),
    );
    expect(mockSetSessionData).toHaveBeenCalledWith(
      { userId: 'vendor-owner-1', email: 'riverside@autoserve.app' },
      expect.objectContaining({
        fullName: 'Alex Rivers',
        phone: '+1 310 555 0101',
        businessType: 'shop',
      }),
    );
  });
});
