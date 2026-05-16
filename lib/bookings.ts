import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { BookingMode, BookingRecord, BookingServiceSnapshot, Service, VendorSummary, Vehicle } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIsoTimestamp(date: string, time: string): string {
  const [hhmm, period] = time.split(' ');
  let [h, m] = hhmm.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// ─── Selectors (sync, demo-store only) ───────────────────────────────────────

export function getBookingsForClient(clientId: string): BookingRecord[] {
  return useDemoDataStore.getState().bookings.filter((b) => b.clientId === clientId);
}

export function getBookingsForVendor(vendorId: string): BookingRecord[] {
  return useDemoDataStore.getState().bookings.filter((b) => b.vendorId === vendorId);
}

export function getBookingByIdFromStore(bookingId: string): BookingRecord | null {
  return useDemoDataStore.getState().bookings.find((booking) => booking.id === bookingId) ?? null;
}

// ─── DB row mapping ───────────────────────────────────────────────────────────

function rowToRecord(item: Record<string, unknown>): BookingRecord {
  const serviceIds: string[] =
    Array.isArray(item.service_ids) && (item.service_ids as unknown[]).length
      ? (item.service_ids as string[])
      : typeof item.service_id === 'string'
        ? [item.service_id]
        : [];

  const services: BookingServiceSnapshot[] = Array.isArray(item.services_snapshot)
    ? (item.services_snapshot as BookingServiceSnapshot[])
    : [];

  const total = typeof item.total === 'number' ? item.total : 0;

  return {
    id: item.id as string,
    clientId: item.client_id as string,
    clientName: (item.client_name as string | undefined) ?? undefined,
    vendorId: item.vendor_id as string,
    vendorName: (item.vendor_name as string | undefined) ?? undefined,
    vehicleId: item.vehicle_id as string,
    serviceIds,
    services,
    bookingMode: item.booking_mode as BookingMode,
    mobileAddress: (item.mobile_address as string | undefined) ?? undefined,
    scheduledAt: item.scheduled_at as string,
    appointmentDate: (item.appointment_date as string | undefined) ?? undefined,
    appointmentTime: (item.appointment_time as string | undefined) ?? undefined,
    status: item.status as BookingRecord['status'],
    notes: (item.notes as string | undefined) ?? undefined,
    photos: Array.isArray(item.photos) ? (item.photos as string[]) : [],
    subtotal: item.subtotal as number,
    serviceFee: item.service_fee as number,
    total,
    totalPrice: total,
    createdAt: item.created_at as string,
    updatedAt: (item.updated_at as string | undefined) ?? undefined,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBookingsForCurrentUser(): Promise<BookingRecord[]> {
  const { session, profile, guestMode, guestClientId } = useAuthStore.getState();

  if (!session) {
    if (guestMode && guestClientId) {
      return useDemoDataStore.getState().bookings.filter((b) => b.clientId === guestClientId);
    }
    return [];
  }

  const isVendor = profile?.role === 'vendor';

  if (!isSupabaseConfigured || !supabase) {
    const bookings = useDemoDataStore.getState().bookings;
    return isVendor
      ? bookings.filter((booking) =>
          useDemoDataStore.getState().vendors.some((vendor) => vendor.id === booking.vendorId && vendor.ownerId === session.userId)
        )
      : bookings.filter((booking) => booking.clientId === session.userId);
  }

  let data: Record<string, unknown>[] | null = null;
  let error: unknown = null;

  if (isVendor) {
    const { data: ownedVendors, error: vendorError } = await supabase.from('vendors').select('id').eq('owner_id', session.userId);
    if (vendorError) {
      error = vendorError;
    } else {
      const vendorIds = ownedVendors.map((v: { id: string }) => v.id);
      const response = await supabase.from('bookings').select('*').in('vendor_id', vendorIds.length ? vendorIds : ['']);
      data = response.data;
      error = response.error;
    }
  } else {
    const response = await supabase.from('bookings').select('*').eq('client_id', session.userId);
    data = response.data;
    error = response.error;
  }

  if (error || !data) return [];
  return data.map(rowToRecord);
}

export async function getBookingById(bookingId: string): Promise<BookingRecord | null> {
  if (!isSupabaseConfigured || !supabase) {
    return getBookingByIdFromStore(bookingId);
  }

  const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data);
}

// ─── Create (low-level) ───────────────────────────────────────────────────────

export async function createBooking(input: Omit<BookingRecord, 'id' | 'createdAt'>): Promise<BookingRecord> {
  const now = new Date().toISOString();
  const booking: BookingRecord = {
    ...input,
    id: `booking-${Date.now()}`,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    totalPrice: input.total,
  };

  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().addBooking(booking);
    return booking;
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      client_id: booking.clientId,
      client_name: booking.clientName ?? null,
      vendor_id: booking.vendorId,
      vendor_name: booking.vendorName ?? null,
      service_id: booking.serviceIds[0] ?? null,
      service_ids: booking.serviceIds,
      services_snapshot: booking.services,
      vehicle_id: booking.vehicleId,
      booking_mode: booking.bookingMode,
      mobile_address: booking.mobileAddress ?? null,
      scheduled_at: booking.scheduledAt,
      status: booking.status,
      notes: booking.notes ?? null,
      photos: booking.photos ?? [],
      subtotal: booking.subtotal,
      service_fee: booking.serviceFee,
      total: booking.total,
      updated_at: booking.updatedAt,
    })
    .select('*')
    .single();

  if (error || !data) {
    const isAuthenticated = Boolean(useAuthStore.getState().session);
    if (isAuthenticated) {
      throw new Error(error ? (error as { message?: string }).message ?? String(error) : 'Booking insert returned no data');
    }
    useDemoDataStore.getState().addBooking(booking);
    return booking;
  }

  return rowToRecord(data);
}

// ─── Create (high-level flow) ─────────────────────────────────────────────────

export interface CreateBookingSelections {
  vendor: Pick<VendorSummary, 'id' | 'name'>;
  vehicle: Pick<Vehicle, 'id'>;
  services: Pick<Service, 'id' | 'title' | 'category' | 'price' | 'durationMinutes'>[];
  scheduledDate: string;
  scheduledTime: string;
  bookingMode: BookingMode;
  mobileAddress?: string;
  notes?: string;
  photos?: string[];
  clientId: string;
  clientName?: string;
}

export async function createBookingFromSelections(input: CreateBookingSelections): Promise<BookingRecord> {
  const { vendor, vehicle, services, scheduledDate, scheduledTime, bookingMode, mobileAddress, notes, photos, clientId, clientName } = input;

  const snapshot: BookingServiceSnapshot[] = services.map((s) => ({
    serviceId: s.id,
    title: s.title,
    category: s.category,
    price: s.price,
    durationMinutes: s.durationMinutes,
  }));

  const subtotal = services.reduce((sum, s) => sum + s.price, 0);
  const serviceFee = Math.round(subtotal * 0.12 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  return createBooking({
    clientId,
    clientName,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vehicleId: vehicle.id,
    serviceIds: services.map((s) => s.id),
    services: snapshot,
    bookingMode,
    mobileAddress,
    scheduledAt: toIsoTimestamp(scheduledDate, scheduledTime),
    appointmentDate: scheduledDate,
    appointmentTime: scheduledTime,
    status: 'pending',
    notes,
    photos,
    subtotal,
    serviceFee,
    total,
    totalPrice: total,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Update status ────────────────────────────────────────────────────────────

export async function updateBookingStatus(bookingId: string, status: BookingRecord['status']): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().updateBookingStatus(bookingId, status);
    return;
  }

  await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', bookingId);
}
