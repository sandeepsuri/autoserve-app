import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { demoBookings, demoProfiles, demoReviews, demoServices, demoVehicles, demoVendors } from '@/constants/mock-data';
import { BookingRecord, Service, UserProfile, Vehicle, VendorOnboardingDraft, VendorSummary } from '@/types/domain';

interface DemoDataState {
  profiles: UserProfile[];
  vendors: VendorSummary[];
  services: Service[];
  vehicles: Vehicle[];
  bookings: BookingRecord[];
  onboardingDrafts: VendorOnboardingDraft[];
  addOrUpdateProfile: (profile: UserProfile) => void;
  addVehicle: (vehicle: Vehicle) => void;
  addBooking: (booking: BookingRecord) => void;
  updateBookingStatus: (bookingId: string, status: BookingRecord['status']) => void;
  upsertService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateVendor: (vendorId: string, patch: Partial<VendorSummary>) => void;
  upsertVendor: (vendor: VendorSummary) => void;
  saveOnboardingDraft: (draft: VendorOnboardingDraft) => void;
}

export const useDemoDataStore = create<DemoDataState>()(
  persist(
    (set) => ({
      profiles: demoProfiles,
      vendors: demoVendors,
      services: demoServices,
      vehicles: demoVehicles,
      bookings: demoBookings,
      onboardingDrafts: [],
      addOrUpdateProfile: (profile) =>
        set((state) => ({
          profiles: state.profiles.some((item) => item.id === profile.id)
            ? state.profiles.map((item) => (item.id === profile.id ? { ...item, ...profile } : item))
            : [...state.profiles, profile],
        })),
      addVehicle: (vehicle) => set((state) => ({ vehicles: [vehicle, ...state.vehicles] })),
      addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
      updateBookingStatus: (bookingId, status) =>
        set((state) => ({
          bookings: state.bookings.map((booking) =>
            booking.id === bookingId ? { ...booking, status, updatedAt: new Date().toISOString() } : booking
          ),
        })),
      upsertService: (service) =>
        set((state) => ({
          services: state.services.some((item) => item.id === service.id)
            ? state.services.map((item) => (item.id === service.id ? service : item))
            : [service, ...state.services],
        })),
      removeService: (serviceId) =>
        set((state) => ({ services: state.services.filter((item) => item.id !== serviceId) })),
      updateVendor: (vendorId, patch) =>
        set((state) => ({
          vendors: state.vendors.map((vendor) => (vendor.id === vendorId ? { ...vendor, ...patch } : vendor)),
        })),
      upsertVendor: (vendor) =>
        set((state) => ({
          vendors: state.vendors.some((item) => item.id === vendor.id)
            ? state.vendors.map((item) => (item.id === vendor.id ? vendor : item))
            : [vendor, ...state.vendors],
        })),
      saveOnboardingDraft: (draft) =>
        set((state) => ({
          onboardingDrafts: state.onboardingDrafts.some((item) => item.ownerId === draft.ownerId)
            ? state.onboardingDrafts.map((item) => (item.ownerId === draft.ownerId ? draft : item))
            : [draft, ...state.onboardingDrafts],
        })),
    }),
    {
      name: 'autoserve-demo-data',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        vendors: state.vendors,
        services: state.services,
        vehicles: state.vehicles,
        bookings: state.bookings,
        onboardingDrafts: state.onboardingDrafts,
      }),
    }
  )
);

export const demoReviewsState = demoReviews;
