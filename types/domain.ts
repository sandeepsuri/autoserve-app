export type UserRole = 'client' | 'vendor';
export type BusinessType = 'shop' | 'solo';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type BookingMode = 'shop' | 'mobile';
export type ServiceCategory = 'tire' | 'oil' | 'brakes' | 'diagnostics' | 'repairs' | 'bodywork';
export type VendorLocationMode = 'fixed' | 'mobile' | 'hybrid';

export interface AppSession {
  userId: string;
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role?: UserRole;
  businessType?: BusinessType;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VendorSummary {
  id: string;
  ownerId: string;
  businessType: BusinessType;
  name: string;
  description: string;
  address: string;
  distanceMiles: number;
  rating: number;
  reviewCount: number;
  mobileServiceEnabled: boolean;
  serviceRadiusMiles: number;
  nextAvailable: string;
  heroImage: string;
  serviceCategories: ServiceCategory[];
  coordinates: Coordinates;
}

export interface Service {
  id: string;
  vendorId: string;
  title: string;
  category: ServiceCategory;
  durationMinutes: number;
  price: number;
  active: boolean;
  description?: string;
  image?: string;
}

export interface VendorOnboardingProfileDraft {
  businessName?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface VendorOnboardingLocationDraft {
  mode?: VendorLocationMode;
  address?: string;
  coordinates?: Partial<Coordinates>;
  serviceRadiusMiles?: number;
}

export interface VendorOnboardingServiceDraft {
  id?: string;
  title?: string;
  category?: ServiceCategory;
  description?: string;
  durationMinutes?: number;
  price?: number;
  active?: boolean;
}

export interface VendorOnboardingDraft {
  ownerId: string;
  businessType?: BusinessType;
  profile: VendorOnboardingProfileDraft;
  location: VendorOnboardingLocationDraft;
  services: VendorOnboardingServiceDraft[];
  completed: boolean;
  submittedAt?: string;
  updatedAt?: string;
}

export interface VendorOnboardingDraftPatch {
  businessType?: BusinessType;
  profile?: Partial<VendorOnboardingProfileDraft>;
  location?: {
    mode?: VendorLocationMode;
    address?: string;
    coordinates?: Partial<Coordinates>;
    serviceRadiusMiles?: number;
  };
  services?: VendorOnboardingServiceDraft[];
  completed?: boolean;
  submittedAt?: string;
}

export interface Review {
  id: string;
  bookingId: string;
  vendorId: string;
  clientId: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year: string;
  nickname?: string;
  isDefault?: boolean;
}

export interface BookingDraft {
  vendorId?: string;
  serviceId?: string;
  vehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  bookingMode?: BookingMode;
  scheduledDate?: string;
  scheduledTime?: string;
  mobileAddress?: string;
}

export interface BookingRecord {
  id: string;
  clientId: string;
  vendorId: string;
  serviceId: string;
  vehicleId: string;
  bookingMode: BookingMode;
  mobileAddress?: string;
  scheduledAt: string;
  status: BookingStatus;
  subtotal: number;
  serviceFee: number;
  total: number;
  createdAt: string;
}

export interface DiscoveryFilters {
  query: string;
  mobileOnly: boolean;
  minimumRating: number;
  category: 'all' | ServiceCategory;
  maxDistanceMiles: number;
}

export interface AvailabilitySlot {
  date: string;
  label: string;
  times: string[];
}
