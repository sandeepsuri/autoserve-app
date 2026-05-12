import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { BookingRecord } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

export async function listBookingsForCurrentUser() {
  const { session, profile } = useAuthStore.getState();
  if (!session || !profile?.role) return [];

  if (!isSupabaseConfigured || !supabase) {
    const bookings = useDemoDataStore.getState().bookings;
    return profile.role === 'vendor'
      ? bookings.filter((booking) => useDemoDataStore.getState().vendors.some((vendor) => vendor.id === booking.vendorId && vendor.ownerId === session.userId))
      : bookings.filter((booking) => booking.clientId === session.userId);
  }

  let data;
  let error;

  if (profile.role === 'vendor') {
    const { data: ownedVendors, error: vendorError } = await supabase.from('vendors').select('id').eq('owner_id', session.userId);
    if (vendorError) {
      error = vendorError;
    } else {
      const vendorIds = ownedVendors.map((vendor) => vendor.id);
      const response = await supabase.from('bookings').select('*').in('vendor_id', vendorIds.length ? vendorIds : ['']);
      data = response.data;
      error = response.error;
    }
  } else {
    const response = await supabase.from('bookings').select('*').eq('client_id', session.userId);
    data = response.data;
    error = response.error;
  }

  if (error || !data) {
    return [];
  }

  return data.map(
    (item): BookingRecord => ({
      id: item.id,
      clientId: item.client_id,
      vendorId: item.vendor_id,
      serviceId: item.service_id,
      vehicleId: item.vehicle_id,
      bookingMode: item.booking_mode,
      mobileAddress: item.mobile_address ?? undefined,
      scheduledAt: item.scheduled_at,
      status: item.status,
      subtotal: item.subtotal,
      serviceFee: item.service_fee,
      total: item.total,
      createdAt: item.created_at,
    })
  );
}

export async function createBooking(input: Omit<BookingRecord, 'id' | 'createdAt'>) {
  const booking: BookingRecord = {
    ...input,
    id: `booking-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().addBooking(booking);
    return booking;
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      client_id: booking.clientId,
      vendor_id: booking.vendorId,
      service_id: booking.serviceId,
      vehicle_id: booking.vehicleId,
      booking_mode: booking.bookingMode,
      mobile_address: booking.mobileAddress ?? null,
      scheduled_at: booking.scheduledAt,
      status: booking.status,
      subtotal: booking.subtotal,
      service_fee: booking.serviceFee,
      total: booking.total,
    })
    .select('*')
    .single();

  if (error || !data) {
    useDemoDataStore.getState().addBooking(booking);
    return booking;
  }

  return {
    id: data.id,
    clientId: data.client_id,
    vendorId: data.vendor_id,
    serviceId: data.service_id,
    vehicleId: data.vehicle_id,
    bookingMode: data.booking_mode,
    mobileAddress: data.mobile_address ?? undefined,
    scheduledAt: data.scheduled_at,
    status: data.status,
    subtotal: data.subtotal,
    serviceFee: data.service_fee,
    total: data.total,
    createdAt: data.created_at,
  };
}

export async function updateBookingStatus(bookingId: string, status: BookingRecord['status']) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().updateBookingStatus(bookingId, status);
    return;
  }

  await supabase.from('bookings').update({ status }).eq('id', bookingId);
}
