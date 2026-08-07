jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const mockAddBooking = jest.fn();
const mockUpdateBookingStatus = jest.fn();
let mockBookings: import('@/types/domain').BookingRecord[] = [];
let mockVendors: import('@/types/domain').VendorSummary[] = [];
let mockAuthState: {
  session: { userId: string; email: string } | null;
  profile: { role: 'client' | 'vendor' } | null;
  vendorCapability: { hasActiveVendor: boolean } | null;
  guestMode: boolean;
  guestClientId: string | null;
} = {
  session: { userId: 'client-1', email: 'client@example.com' },
  profile: { role: 'client' as const },
  vendorCapability: null,
  guestMode: false,
  guestClientId: null as string | null,
};

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

let mockVehicles: import('@/types/domain').Vehicle[] = [];

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: {
    getState: () => ({
      get bookings() {
        return mockBookings;
      },
      get vendors() {
        return mockVendors;
      },
      get vehicles() {
        return mockVehicles;
      },
      addBooking: mockAddBooking,
      updateBookingStatus: mockUpdateBookingStatus,
    }),
  },
}));

import { BookingRecord, Service, VendorSummary, Vehicle } from '@/types/domain';
import {
  createBookingFromSelections,
  createGuestBookingFromSelections,
  getBookingByIdFromStore,
  getBookingsForClient,
  getBookingsForVendor,
  listBookingsForCurrentUser,
  listBookingsForVendorOwner,
  updateBookingStatus,
} from '@/lib/bookings';

const makeService = (overrides: Partial<Service> = {}): Service => ({
  id: 'svc-1',
  vendorId: 'v1',
  title: 'Oil Change',
  category: 'oil',
  durationMinutes: 30,
  price: 80,
  active: true,
  ...overrides,
});

const makeVendor = (): Pick<VendorSummary, 'id' | 'name'> => ({ id: 'v1', name: 'Riverside Auto' });
const makeVehicle = (): Pick<Vehicle, 'id'> => ({ id: 'veh-1' });

const baseSelections = {
  vendor: makeVendor(),
  vehicle: makeVehicle(),
  services: [makeService()],
  scheduledDate: '2026-06-01',
  scheduledTime: '10:00 AM',
  bookingMode: 'shop' as const,
  clientId: 'client-1',
  clientName: 'Jane Doe',
};

const makeRecord = (overrides: Partial<BookingRecord> = {}): BookingRecord => ({
  id: 'b1',
  clientId: 'client-1',
  vendorId: 'v1',
  vehicleId: 'veh-1',
  serviceIds: ['svc-1'],
  services: [{ serviceId: 'svc-1', title: 'Oil Change', category: 'oil', price: 80, durationMinutes: 30 }],
  bookingMode: 'shop',
  scheduledAt: '2026-06-01 10:00 AM',
  status: 'pending',
  subtotal: 80,
  serviceFee: 9.6,
  total: 89.6,
  totalPrice: 89.6,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockBookings = [];
  mockVendors = [];
  mockVehicles = [];
  mockAuthState = {
    session: { userId: 'client-1', email: 'client@example.com' },
    profile: { role: 'client' },
    vendorCapability: null,
    guestMode: false,
    guestClientId: null,
  };
  mockAddBooking.mockImplementation((b: BookingRecord) => {
    mockBookings.push(b);
  });
});

// ─── createBookingFromSelections ──────────────────────────────────────────────

describe('createBookingFromSelections', () => {
  it('derives subtotal as sum of service prices', async () => {
    const services = [makeService({ price: 80 }), makeService({ id: 'svc-2', price: 45 })];
    const booking = await createBookingFromSelections({ ...baseSelections, services });
    expect(booking.subtotal).toBe(125);
  });

  it('derives serviceFee as 12% of subtotal rounded to cents', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.serviceFee).toBe(9.6);
  });

  it('total equals subtotal + serviceFee', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.total).toBeCloseTo(booking.subtotal + booking.serviceFee, 2);
  });

  it('totalPrice equals total', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.totalPrice).toBe(booking.total);
  });

  it('status is pending', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.status).toBe('pending');
  });

  it('assigns a public reference in demo mode', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.publicReference).toMatch(/^AS-[A-Z0-9]{8}$/);
  });

  it('populates serviceIds from selected services', async () => {
    const services = [makeService({ id: 'svc-a' }), makeService({ id: 'svc-b' })];
    const booking = await createBookingFromSelections({ ...baseSelections, services });
    expect(booking.serviceIds).toEqual(['svc-a', 'svc-b']);
  });

  it('snapshots service title, price, category, durationMinutes', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.services).toHaveLength(1);
    expect(booking.services[0]).toMatchObject({
      serviceId: 'svc-1',
      title: 'Oil Change',
      category: 'oil',
      price: 80,
      durationMinutes: 30,
    });
  });

  it('sets appointmentDate and appointmentTime from selections', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.appointmentDate).toBe('2026-06-01');
    expect(booking.appointmentTime).toBe('10:00 AM');
  });

  it('denormalizes clientName and vendorName', async () => {
    const booking = await createBookingFromSelections(baseSelections);
    expect(booking.clientName).toBe('Jane Doe');
    expect(booking.vendorName).toBe('Riverside Auto');
  });

  it('sets createdAt and updatedAt', async () => {
    const before = new Date().toISOString();
    const booking = await createBookingFromSelections(baseSelections);
    const after = new Date().toISOString();
    expect(booking.createdAt >= before).toBe(true);
    expect(booking.createdAt <= after).toBe(true);
    expect(booking.updatedAt).toBeDefined();
  });

  it('calls addBooking on the demo store', async () => {
    await createBookingFromSelections(baseSelections);
    expect(mockAddBooking).toHaveBeenCalledTimes(1);
  });

  it('passes notes through to the booking record', async () => {
    const booking = await createBookingFromSelections({ ...baseSelections, notes: 'Grinding noise on turns' });
    expect(booking.notes).toBe('Grinding noise on turns');
  });
});

describe('createGuestBookingFromSelections', () => {
  const guestSelections = {
    vendor: makeVendor(),
    contact: { name: 'Jordan Lee', email: 'JORDAN@example.com', phone: '(416) 555-0182' },
    vehicle: { make: 'Honda', model: 'Civic', year: '2021', color: 'Blue', plate: 'abc 123' },
    services: [makeService()],
    scheduledDate: '2026-06-01',
    scheduledTime: '10:00',
    bookingMode: 'shop' as const,
    idempotencyKey: '79f04d1e-6c22-4c9a-bc23-8ea794e372af',
  };

  it('creates a pending guest request without client or saved vehicle ids', async () => {
    const booking = await createGuestBookingFromSelections(guestSelections);
    expect(booking).toMatchObject({
      bookingOrigin: 'guest',
      status: 'pending',
      vehicleLabel: '2021 Honda Civic',
      clientName: 'Jordan Lee',
    });
    expect(booking.clientId).toBeUndefined();
    expect(booking.vehicleId).toBeUndefined();
  });

  it('normalizes guest contact snapshots and preserves vehicle details', async () => {
    const booking = await createGuestBookingFromSelections(guestSelections);
    expect(booking.guestEmail).toBe('jordan@example.com');
    expect(booking.guestPhone).toBe('4165550182');
    expect(booking.vehicleColor).toBe('Blue');
    expect(booking.vehiclePlate).toBe('abc 123');
  });

  it('uses server-equivalent pricing and pay-later state in demo mode', async () => {
    const booking = await createGuestBookingFromSelections(guestSelections);
    expect(booking.subtotal).toBe(80);
    expect(booking.serviceFee).toBe(9.6);
    expect(booking.total).toBe(89.6);
    expect(booking.paymentStatus).toBeUndefined();
  });
});

// ─── getBookingsForClient ─────────────────────────────────────────────────────

describe('getBookingsForClient', () => {
  it('returns only bookings for the given clientId', () => {
    mockBookings = [
      makeRecord({ id: 'b1', clientId: 'client-1' }),
      makeRecord({ id: 'b2', clientId: 'client-2' }),
      makeRecord({ id: 'b3', clientId: 'client-1' }),
    ];
    const result = getBookingsForClient('client-1');
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toEqual(['b1', 'b3']);
  });

  it('returns empty array when no matching bookings', () => {
    mockBookings = [makeRecord({ clientId: 'client-2' })];
    expect(getBookingsForClient('client-1')).toHaveLength(0);
  });
});

// ─── getBookingsForVendor ─────────────────────────────────────────────────────

describe('getBookingsForVendor', () => {
  it('returns only bookings for the given vendorId', () => {
    mockBookings = [
      makeRecord({ id: 'b1', vendorId: 'v1' }),
      makeRecord({ id: 'b2', vendorId: 'v2' }),
    ];
    const result = getBookingsForVendor('v1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
  });

  it('returns empty array when no matching bookings', () => {
    mockBookings = [];
    expect(getBookingsForVendor('v1')).toHaveLength(0);
  });
});

describe('listBookingsForCurrentUser', () => {
  it('returns client bookings for a signed-in client in demo mode', async () => {
    mockBookings = [
      makeRecord({ id: 'b1', clientId: 'client-1' }),
      makeRecord({ id: 'b2', clientId: 'client-2' }),
    ];

    await expect(listBookingsForCurrentUser()).resolves.toEqual([mockBookings[0]]);
  });

  it('returns guest bookings when no session exists in guest mode', async () => {
    mockBookings = [
      makeRecord({ id: 'b1', clientId: 'guest-1' }),
      makeRecord({ id: 'b2', clientId: 'client-2' }),
    ];
    mockAuthState = {
      session: null,
      profile: null,
      vendorCapability: null,
      guestMode: true,
      guestClientId: 'guest-1',
    };

    await expect(listBookingsForCurrentUser()).resolves.toEqual([mockBookings[0]]);
  });

  it('returns vendor-owned bookings (not client-id bookings) for an approved-active vendor capability', async () => {
    mockBookings = [
      makeRecord({ id: 'b1', vendorId: 'v1' }),
      makeRecord({ id: 'b2', vendorId: 'v2' }),
    ];
    mockVendors = [
      {
        id: 'v1',
        ownerId: 'vendor-owner-1',
        businessType: 'shop',
        name: 'Riverside Auto',
        description: 'desc',
        address: '123 Main',
        distanceMiles: 0,
        rating: 5,
        reviewCount: 1,
        mobileServiceEnabled: false,
        serviceRadiusMiles: 0,
        nextAvailable: 'Soon',
        heroImage: 'img',
        serviceCategories: ['oil'],
        coordinates: { latitude: 0, longitude: 0 },
      },
    ];
    mockAuthState = {
      session: { userId: 'vendor-owner-1', email: 'vendor@example.com' },
      // profiles.role stays 'client' under Option B even for approved
      // vendors — only vendorCapability.hasActiveVendor should gate this.
      profile: { role: 'client' },
      vendorCapability: { hasActiveVendor: true },
      guestMode: false,
      guestClientId: null,
    };

    await expect(listBookingsForCurrentUser()).resolves.toEqual([mockBookings[0]]);
  });

  it('returns client-id bookings (not vendor-owned bookings) when capability has no active vendor', async () => {
    mockBookings = [
      makeRecord({ id: 'b1', clientId: 'client-1' }),
      makeRecord({ id: 'b2', vendorId: 'v1', clientId: 'someone-else' }),
    ];
    mockAuthState = {
      session: { userId: 'client-1', email: 'client@example.com' },
      profile: { role: 'client' },
      vendorCapability: { hasActiveVendor: false },
      guestMode: false,
      guestClientId: null,
    };

    await expect(listBookingsForCurrentUser()).resolves.toEqual([mockBookings[0]]);
  });
});

describe('listBookingsForVendorOwner', () => {
  it('returns bookings linked to vendors owned by the signed-in vendor', async () => {
    mockAuthState = {
      session: { userId: 'vendor-owner-1', email: 'vendor@example.com' },
      profile: { role: 'vendor' },
      vendorCapability: { hasActiveVendor: true },
      guestMode: false,
      guestClientId: null,
    };
    mockVendors = [
      {
        id: 'v1',
        ownerId: 'vendor-owner-1',
        businessType: 'shop',
        name: 'Riverside Auto',
        description: 'desc',
        address: '123 Main',
        distanceMiles: 0,
        rating: 5,
        reviewCount: 1,
        mobileServiceEnabled: false,
        serviceRadiusMiles: 0,
        nextAvailable: 'Soon',
        heroImage: 'img',
        serviceCategories: ['oil'],
        coordinates: { latitude: 0, longitude: 0 },
      },
      {
        id: 'v2',
        ownerId: 'vendor-owner-2',
        businessType: 'shop',
        name: 'Other Auto',
        description: 'desc',
        address: '456 Side',
        distanceMiles: 0,
        rating: 4,
        reviewCount: 1,
        mobileServiceEnabled: false,
        serviceRadiusMiles: 0,
        nextAvailable: 'Soon',
        heroImage: 'img',
        serviceCategories: ['oil'],
        coordinates: { latitude: 0, longitude: 0 },
      },
    ];
    mockBookings = [
      makeRecord({ id: 'b1', vendorId: 'v1' }),
      makeRecord({ id: 'b2', vendorId: 'v2' }),
    ];

    await expect(listBookingsForVendorOwner()).resolves.toEqual([mockBookings[0]]);
  });

  it('returns an empty array when the vendor owns no vendors in demo mode', async () => {
    mockAuthState = {
      session: { userId: 'vendor-owner-1', email: 'vendor@example.com' },
      profile: { role: 'vendor' },
      vendorCapability: { hasActiveVendor: true },
      guestMode: false,
      guestClientId: null,
    };

    await expect(listBookingsForVendorOwner()).resolves.toEqual([]);
  });
});

describe('getBookingByIdFromStore', () => {
  it('returns the matching booking when present', () => {
    mockBookings = [makeRecord({ id: 'b1' }), makeRecord({ id: 'b2' })];
    expect(getBookingByIdFromStore('b2')?.id).toBe('b2');
  });

  it('returns null when the booking does not exist', () => {
    mockBookings = [makeRecord({ id: 'b1' })];
    expect(getBookingByIdFromStore('missing')).toBeNull();
  });
});

// ─── updateBookingStatus ──────────────────────────────────────────────────────

describe('updateBookingStatus', () => {
  it('delegates to demo store updateBookingStatus', async () => {
    await updateBookingStatus('b1', 'confirmed');
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith('b1', 'confirmed');
  });
});

// ─── createBookingFromSelections — vehicle validation ─────────────────────────

describe('createBookingFromSelections — vehicle linkage', () => {
  it('uses the provided vehicleId on the created booking record', async () => {
    const booking = await createBookingFromSelections({
      ...baseSelections,
      vehicle: { id: 'saved-veh-1', make: 'Honda', model: 'Civic', year: '2022' },
    });
    expect(booking.vehicleId).toBe('saved-veh-1');
  });

  it('builds vehicleLabel from provided make/model/year', async () => {
    const booking = await createBookingFromSelections({
      ...baseSelections,
      vehicle: { id: 'saved-veh-1', make: 'Honda', model: 'Civic', year: '2022' },
    });
    expect(booking.vehicleLabel).toBe('2022 Honda Civic');
  });

  it('includes nickname in vehicleLabel when provided', async () => {
    const booking = await createBookingFromSelections({
      ...baseSelections,
      vehicle: { id: 'saved-veh-1', make: 'Honda', model: 'Civic', year: '2022', nickname: 'My Civic' },
    });
    expect(booking.vehicleLabel).toBe('My Civic (2022 Honda Civic)');
  });

  it('fetches vehicleLabel from saved store when only id is provided', async () => {
    mockVehicles = [
      {
        id: 'saved-veh-2',
        ownerId: 'client-1',
        make: 'Toyota',
        model: 'Camry',
        year: '2020',
        isDefault: true,
      },
    ];
    const booking = await createBookingFromSelections({
      ...baseSelections,
      vehicle: { id: 'saved-veh-2' },
    });
    expect(booking.vehicleLabel).toBe('2020 Toyota Camry');
    expect(booking.vehicleId).toBe('saved-veh-2');
  });

  it('throws a clear error when vehicle id is missing', async () => {
    await expect(
      createBookingFromSelections({
        ...baseSelections,
        vehicle: { id: '' },
      })
    ).rejects.toThrow('A vehicle is required to book a service.');
  });
});
