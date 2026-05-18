import { BookingRecord, Review, Service, UserProfile, Vehicle, VendorSummary } from '@/types/domain';

export const demoProfiles: UserProfile[] = [
  {
    id: 'vendor-owner-riverside',
    email: 'riverside@autoserve.app',
    fullName: 'Alex Rivers',
    role: 'vendor',
    businessType: 'shop',
  },
  {
    id: 'vendor-owner-precbn',
    email: 'precision@autoserve.app',
    fullName: 'Sarah Jenkins',
    role: 'vendor',
    businessType: 'solo',
  },
];

export const demoVendors: VendorSummary[] = [
  {
    id: 'vendor-riverside',
    ownerId: 'vendor-owner-riverside',
    businessType: 'shop',
    name: 'Riverside Auto Elite',
    description: 'Top-rated diagnostics, tires, and quick-turn maintenance with certified technicians.',
    address: '482 Riverside Way, Los Angeles, CA 90210',
    distanceMiles: 1.4,
    rating: 4.8,
    reviewCount: 124,
    mobileServiceEnabled: true,
    serviceRadiusMiles: 25,
    nextAvailable: 'Tomorrow, 9:30 AM',
    heroImage: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1200&q=80',
    serviceCategories: ['tire', 'oil', 'diagnostics'],
    coordinates: { latitude: 34.0522, longitude: -118.2437 },
  },
  {
    id: 'vendor-precbn',
    ownerId: 'vendor-owner-precbn',
    businessType: 'solo',
    name: 'Precision Auto Care',
    description: 'European vehicle specialist with transparent pricing and same-day mobile service.',
    address: '1010 Sunset Blvd, Los Angeles, CA 90012',
    distanceMiles: 0.8,
    rating: 4.9,
    reviewCount: 87,
    mobileServiceEnabled: true,
    serviceRadiusMiles: 18,
    nextAvailable: 'Today, 4:15 PM',
    heroImage: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=1200&q=80',
    serviceCategories: ['diagnostics', 'brakes', 'oil'],
    coordinates: { latitude: 34.047, longitude: -118.25 },
  },
  {
    id: 'vendor-body-paint',
    ownerId: 'vendor-owner-riverside',
    businessType: 'shop',
    name: 'Elite Body & Paint',
    description: 'Collision repair and detailing with pickup options for busy schedules.',
    address: '640 Grand Ave, Los Angeles, CA 90017',
    distanceMiles: 1.5,
    rating: 4.7,
    reviewCount: 59,
    mobileServiceEnabled: false,
    serviceRadiusMiles: 0,
    nextAvailable: 'Mon, 10:00 AM',
    heroImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    serviceCategories: ['bodywork', 'repairs'],
    coordinates: { latitude: 34.0487, longitude: -118.256 },
  },
];

export const demoServices: Service[] = [
  { id: 'svc-1', vendorId: 'vendor-riverside', title: 'Tire Change', category: 'tire', durationMinutes: 45, price: 85, active: true },
  { id: 'svc-2', vendorId: 'vendor-riverside', title: 'Oil Change', category: 'oil', durationMinutes: 30, price: 80, active: true },
  { id: 'svc-3', vendorId: 'vendor-riverside', title: 'Brake Check', category: 'brakes', durationMinutes: 40, price: 45, active: true },
  { id: 'svc-4', vendorId: 'vendor-precbn', title: 'Full Diagnostics', category: 'diagnostics', durationMinutes: 60, price: 120, active: true },
  { id: 'svc-5', vendorId: 'vendor-precbn', title: 'Brake Pad Replacement', category: 'brakes', durationMinutes: 90, price: 210, active: true },
  { id: 'svc-6', vendorId: 'vendor-body-paint', title: 'Scratch Repair', category: 'bodywork', durationMinutes: 120, price: 275, active: true },
];

export const demoReviews: Review[] = [
  {
    id: 'review-1',
    bookingId: 'booking-seed-1',
    vendorId: 'vendor-riverside',
    clientId: 'client-seed-1',
    author: 'Mark O.',
    rating: 5,
    text: 'Very fast tire service and the technician explained every price clearly before starting.',
    createdAt: '2026-05-02T13:00:00.000Z',
  },
  {
    id: 'review-2',
    bookingId: 'booking-seed-2',
    vendorId: 'vendor-precbn',
    clientId: 'client-seed-2',
    author: 'Sarah L.',
    rating: 5,
    text: 'The mobile mechanic arrived right on time and handled my brake issue in the driveway.',
    createdAt: '2026-05-04T16:30:00.000Z',
  },
];

export const demoVehicles: Vehicle[] = [];
export const demoBookings: BookingRecord[] = [];
