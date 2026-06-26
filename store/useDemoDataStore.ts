import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { demoBookings, demoProfiles, demoReviews, demoServices, demoVehicles, demoVendors } from '@/constants/mock-data';
import { BookingRecord, Service, UserProfile, Vehicle, VendorApplication, VendorOnboardingDraft, VendorSummary, VerificationDocument } from '@/types/domain';
import { VendorAvailability } from '@/store/useVendorAvailabilityStore';

interface DemoDataState {
  profiles: UserProfile[];
  vendors: VendorSummary[];
  services: Service[];
  vehicles: Vehicle[];
  bookings: BookingRecord[];
  onboardingDrafts: VendorOnboardingDraft[];
  vendorApplications: VendorApplication[];
  /** Applicant-uploaded verification documents (metadata only in demo mode) */
  verificationDocuments: VerificationDocument[];
  /** Keyed by vendorId; stores persisted availability for demo vendors */
  vendorAvailabilities: Record<string, VendorAvailability>;
  addOrUpdateProfile: (profile: UserProfile) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, patch: Partial<Omit<Vehicle, 'id' | 'ownerId'>>) => void;
  removeVehicle: (id: string) => void;
  clearVehicleDefaults: (ownerId: string) => void;
  addBooking: (booking: BookingRecord) => void;
  updateBookingStatus: (bookingId: string, status: BookingRecord['status']) => void;
  upsertService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateVendor: (vendorId: string, patch: Partial<VendorSummary>) => void;
  upsertVendor: (vendor: VendorSummary) => void;
  saveOnboardingDraft: (draft: VendorOnboardingDraft) => void;
  saveVendorApplication: (application: VendorApplication) => void;
  addVerificationDocument: (document: VerificationDocument) => void;
  removeVerificationDocument: (documentId: string) => void;
  saveVendorAvailability: (vendorId: string, availability: VendorAvailability) => void;
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
      vendorApplications: [],
      verificationDocuments: [],
      vendorAvailabilities: {},
      addOrUpdateProfile: (profile) =>
        set((state) => ({
          profiles: state.profiles.some((item) => item.id === profile.id)
            ? state.profiles.map((item) => (item.id === profile.id ? { ...item, ...profile } : item))
            : [...state.profiles, profile],
        })),
      addVehicle: (vehicle) => set((state) => ({ vehicles: [vehicle, ...state.vehicles] })),
      updateVehicle: (id, patch) =>
        set((state) => ({
          vehicles: state.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      removeVehicle: (id) =>
        set((state) => ({ vehicles: state.vehicles.filter((v) => v.id !== id) })),
      clearVehicleDefaults: (ownerId) =>
        set((state) => ({
          vehicles: state.vehicles.map((v) => (v.ownerId === ownerId ? { ...v, isDefault: false } : v)),
        })),
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
      saveVendorApplication: (application) =>
        set((state) => ({
          vendorApplications: state.vendorApplications.some((item) => item.ownerId === application.ownerId)
            ? state.vendorApplications.map((item) => (item.ownerId === application.ownerId ? application : item))
            : [application, ...state.vendorApplications],
        })),
      addVerificationDocument: (document) =>
        set((state) => ({
          verificationDocuments: state.verificationDocuments.some((item) => item.id === document.id)
            ? state.verificationDocuments.map((item) => (item.id === document.id ? document : item))
            : [document, ...state.verificationDocuments],
        })),
      removeVerificationDocument: (documentId) =>
        set((state) => ({
          verificationDocuments: state.verificationDocuments.filter((item) => item.id !== documentId),
        })),
      saveVendorAvailability: (vendorId, availability) =>
        set((state) => ({
          vendorAvailabilities: { ...state.vendorAvailabilities, [vendorId]: availability },
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
        vendorApplications: state.vendorApplications,
        verificationDocuments: state.verificationDocuments,
        vendorAvailabilities: state.vendorAvailabilities,
      }),
    }
  )
);

export const demoReviewsState = demoReviews;
