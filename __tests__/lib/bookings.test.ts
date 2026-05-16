jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const mockAddBooking = jest.fn();
const mockUpdateBookingStatus = jest.fn();
let mockBookings: import('@/types/domain').BookingRecord[] = [];

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: {
    getState: () => ({
      get bookings() {
        return mockBookings;
      },
      addBooking: mockAddBooking,
      updateBookingStatus: mockUpdateBookingStatus,
      vendors: [],
    }),
  },
}));

import { BookingRecord, Service, VendorSummary, Vehicle } from '@/types/domain';
import {
  createBookingFromSelections,
  getBookingByIdFromStore,
  getBookingsForClient,
  getBookingsForVendor,
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
