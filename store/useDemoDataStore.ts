import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { demoBookings, demoProfiles, demoReviews, demoServices, demoVehicles, demoVendors } from '@/constants/mock-data';
import { BookingRecord, Service, UserProfile, Vehicle, VendorSummary } from '@/types/domain';

interface DemoDataState {
  profiles: UserProfile[];
  vendors: VendorSummary[];
  services: Service[];
  vehicles: Vehicle[];
  bookings: BookingRecord[];
  addOrUpdateProfile: (profile: UserProfile) => void;
  addVehicle: (vehicle: Vehicle) => void;
  addBooking: (booking: BookingRecord) => void;
  updateBookingStatus: (bookingId: string, status: BookingRecord['status']) => void;
  upsertService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateVendor: (vendorId: string, patch: Partial<VendorSummary>) => void;
}

export const useDemoDataStore = create<DemoDataState>()(
  persist(
    (set) => ({
      profiles: demoProfiles,
      vendors: demoVendors,
      services: demoServices,
      vehicles: demoVehicles,
      bookings: demoBookings,
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
          bookings: state.bookings.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)),
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
      }),
    }
  )
);

export const demoReviewsState = demoReviews;
