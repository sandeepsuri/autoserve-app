import { BookingRecord } from '@/types/domain';

import { getBookingById, updateBookingStatus } from './bookings';
import { extractEdgeFunctionError } from './edge-functions';
import { isSupabaseConfigured, supabase } from './supabase';

export interface BookingPaymentSession {
  paymentRequired: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
}

function mapFunctionBooking(data: unknown): BookingRecord {
  const booking = data as BookingRecord | { booking?: BookingRecord };
  if ('booking' in booking && booking.booking) return booking.booking;
  return booking as BookingRecord;
}

async function invokePaymentFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Payments require a live AutoServe backend.');
  }

  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new Error(await extractEdgeFunctionError(error, `Payment function ${name} failed`));
  }
  return data as T;
}

export async function createBookingPayment(bookingId: string): Promise<BookingPaymentSession> {
  const response = await invokePaymentFunction<{
    payment_required?: boolean;
    client_secret?: string;
    clientSecret?: string;
    payment_intent_id?: string;
    paymentIntentId?: string;
  }>('create-booking-payment', { booking_id: bookingId });

  // Vendor hasn't finished payout setup → booking proceeds without a charge.
  if (response.payment_required === false) {
    return { paymentRequired: false };
  }

  const clientSecret = response.client_secret ?? response.clientSecret;
  const paymentIntentId = response.payment_intent_id ?? response.paymentIntentId;
  if (!clientSecret || !paymentIntentId) {
    throw new Error('Payment setup did not return a Stripe client secret.');
  }

  return { paymentRequired: true, clientSecret, paymentIntentId };
}

export async function captureBookingPayment(bookingId: string): Promise<BookingRecord | null> {
  if (!isSupabaseConfigured || !supabase) {
    return updateBookingStatus(bookingId, 'confirmed');
  }

  const response = await invokePaymentFunction<BookingRecord | { booking: BookingRecord }>('capture-booking-payment', {
    booking_id: bookingId,
  });
  return mapFunctionBooking(response);
}

export async function cancelBookingPayment(bookingId: string): Promise<BookingRecord | null> {
  if (!isSupabaseConfigured || !supabase) {
    return updateBookingStatus(bookingId, 'cancelled');
  }

  const response = await invokePaymentFunction<BookingRecord | { booking: BookingRecord }>('cancel-booking-payment', {
    booking_id: bookingId,
  });
  return mapFunctionBooking(response);
}

export async function cancelUnpaidBookingAfterPaymentFailure(bookingId: string): Promise<void> {
  try {
    await cancelBookingPayment(bookingId);
  } catch {
    const booking = await getBookingById(bookingId);
    if (booking?.status === 'pending') {
      throw new Error('Payment was not completed. The booking was created but could not be cancelled automatically.');
    }
  }
}
