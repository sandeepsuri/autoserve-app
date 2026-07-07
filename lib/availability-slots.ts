/**
 * lib/availability-slots.ts
 *
 * Client-facing slot query functions.
 * When Supabase is configured, delegates to the server-side
 * vendor_bookable_slots / vendor_next_available RPCs (Ticket 3).
 * Falls back to the FE deriveAvailableSlots logic for demo mode.
 */

import {
  deriveAvailableSlots,
  makeEmptyAvailability,
  VendorAvailability,
} from '@/store/useVendorAvailabilityStore';

import { loadVendorAvailability } from './vendor-availability';
import { isSupabaseConfigured, supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookableSlot {
  date:      string; // "YYYY-MM-DD"
  time:      string; // "HH:MM"
  remaining: number; // capacity minus active bookings
}

// ── Server-side slot query ────────────────────────────────────────────────────

/**
 * Returns available slots for a vendor over a date range.
 * Uses the SQL RPC when Supabase is configured; falls back to FE derivation.
 */
export async function getBookableSlots(
  vendorId:   string,
  serviceId?: string,
  mode?:      'shop' | 'mobile',
  from?:      string, // "YYYY-MM-DD"
  to?:        string, // "YYYY-MM-DD"
): Promise<BookableSlot[]> {
  if (!isSupabaseConfigured || !supabase) {
    return _deriveSlotsFallback(vendorId, from, to);
  }

  const { data, error } = await supabase.rpc('vendor_bookable_slots', {
    p_vendor_id:  vendorId,
    p_service_id: serviceId ?? null,
    p_mode:       mode ?? null,
    p_from:       from ?? undefined,
    p_to:         to ?? undefined,
  });

  if (error) {
    // Graceful fallback — slot lookup failure should not crash the booking screen
    console.warn('[availability-slots] RPC error, falling back to local derivation:', error.message);
    return _deriveSlotsFallback(vendorId, from, to);
  }

  return ((data ?? []) as { slot_date: string; slot_time: string; remaining: number }[]).map((row) => ({
    date:      row.slot_date,
    time:      row.slot_time,
    remaining: row.remaining,
  }));
}

/**
 * Returns the next date/time when the vendor has an available slot.
 */
export async function getNextAvailableSlot(
  vendorId:   string,
  serviceId?: string,
  mode?:      'shop' | 'mobile',
  from?:      string,
): Promise<{ date: string; time: string } | null> {
  if (!isSupabaseConfigured || !supabase) {
    const slots = await _deriveSlotsFallback(vendorId, from, undefined);
    if (!slots.length) return null;
    return { date: slots[0].date, time: slots[0].time };
  }

  const { data, error } = await supabase.rpc('vendor_next_available', {
    p_vendor_id:  vendorId,
    p_service_id: serviceId ?? null,
    p_mode:       mode ?? null,
    p_from:       from ?? undefined,
  });

  if (error || !data || !(data as unknown[]).length) return null;

  const row = (data as { next_date: string; next_time: string }[])[0];
  return { date: row.next_date, time: row.next_time };
}

/**
 * Returns available time slots for a specific date, mirroring deriveAvailableSlots.
 * This is the function the schedule screen uses for individual date rendering.
 */
export async function getSlotsForDate(
  vendorId: string,
  dateIso:  string,
  availability?: VendorAvailability,
): Promise<string[]> {
  // If the caller already has the availability loaded, use local derivation
  // (fast, no extra network round-trip — this matches the FE store pattern).
  const avail = availability ?? await loadVendorAvailability(vendorId);
  return deriveAvailableSlots(dateIso, avail);
}

// ── Local derivation fallback ─────────────────────────────────────────────────

async function _deriveSlotsFallback(
  vendorId: string,
  from?:    string,
  to?:      string,
): Promise<BookableSlot[]> {
  const availability = await loadVendorAvailability(vendorId, { fallback: 'empty' }).catch(() =>
    makeEmptyAvailability(),
  );

  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = from ? new Date(from + 'T00:00:00') : new Date(today.getTime() + 86400000);
  const toDate   = to   ? new Date(to   + 'T00:00:00') : new Date(today.getTime() + 86400000 * 14);

  const slots: BookableSlot[] = [];
  const cur = new Date(fromDate);

  while (cur <= toDate) {
    const iso  = cur.toISOString().slice(0, 10);
    const times = deriveAvailableSlots(iso, availability);
    for (const time of times) {
      slots.push({ date: iso, time, remaining: availability.capacityPerSlot });
    }
    cur.setDate(cur.getDate() + 1);
  }

  return slots;
}
