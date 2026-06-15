/**
 * lib/vendor-availability.ts
 *
 * Service module for vendor availability persistence.
 * All data access for VendorAvailability and BlockedPeriod lives here.
 * UI routes and modals call these functions; they never hit Supabase directly.
 *
 * Follows the isSupabaseConfigured/demo-fallback pattern from lib/vendor-admin.ts.
 */

import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import {
  BlockedPeriod,
  DayOfWeek,
  DayRule,
  makeDefaultAvailability,
  ServiceModeRules,
  SlotLengthMinutes,
  timeToMinutes,
  VendorAvailability,
} from '@/store/useVendorAvailabilityStore';

import { isSupabaseConfigured, supabase } from './supabase';

// ── Row types (DB snake_case) ─────────────────────────────────────────────────

interface VendorAvailabilityRow {
  vendor_id:          string;
  weekly_rules:       Record<string, { bookable: boolean; openTime: string; closeTime: string }>;
  slot_length_minutes: number;
  capacity_per_slot:  number;
  service_mode_rules: {
    shopVisitsEnabled:    boolean;
    mobileServiceEnabled: boolean;
    sameDayBookingEnabled: boolean;
    sameDayLeadHours:     number;
  };
  published_at:       string | null;
  created_at:         string;
  updated_at:         string;
}

interface BlockedPeriodRow {
  id:             string;
  vendor_id:      string;
  date:           string | null;   // "YYYY-MM-DD" or null for purely recurring
  all_day:        boolean;
  start_time:     string | null;   // "HH:MM:SS" from Postgres time type
  end_time:       string | null;
  label:          string;
  recurring:      boolean;
  recurring_days: number[] | null;
  created_at:     string;
  updated_at:     string;
}

// ── Error normalization ───────────────────────────────────────────────────────

/**
 * Supabase PostgrestError is a plain object ({ message, code, details, hint }),
 * NOT an Error instance — so it gets swallowed by `err instanceof Error` checks
 * upstream and shows a generic message with nothing logged. This normalizes it
 * into a real Error carrying the Postgres code, and logs the full payload.
 */
function dbError(e: unknown, ctx: string): Error {
  console.error(`[vendor-availability] ${ctx} failed:`, e);
  const err = e as { message?: string; code?: string; details?: string; hint?: string } | null;
  const code = err?.code ? ` (${err.code})` : '';
  const hint = err?.hint ? ` — ${err.hint}` : '';
  return new Error(`${ctx}: ${err?.message ?? 'Unknown database error'}${code}${hint}`);
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToAvailability(
  row: VendorAvailabilityRow,
  blockedRows: BlockedPeriodRow[],
): VendorAvailability {
  const weeklyRules = {} as Record<DayOfWeek, DayRule>;
  for (let d = 0; d <= 6; d++) {
    const key = String(d);
    const r = row.weekly_rules?.[key];
    weeklyRules[d as DayOfWeek] = r
      ? { bookable: r.bookable, openTime: r.openTime, closeTime: r.closeTime }
      : makeDefaultAvailability().weeklyRules[d as DayOfWeek];
  }

  return {
    publishedAt:       row.published_at ?? undefined,
    weeklyRules,
    slotLengthMinutes: row.slot_length_minutes as SlotLengthMinutes,
    capacityPerSlot:   row.capacity_per_slot,
    blockedPeriods:    blockedRows.map(rowToBlockedPeriod),
    serviceModeRules: {
      shopVisitsEnabled:     row.service_mode_rules?.shopVisitsEnabled    ?? true,
      mobileServiceEnabled:  row.service_mode_rules?.mobileServiceEnabled ?? true,
      sameDayBookingEnabled: row.service_mode_rules?.sameDayBookingEnabled ?? false,
      sameDayLeadHours:      row.service_mode_rules?.sameDayLeadHours     ?? 2,
    },
    quickControls: {},
  };
}

function rowToBlockedPeriod(row: BlockedPeriodRow): BlockedPeriod {
  return {
    id:            row.id,
    date:          row.date ?? '',
    allDay:        row.all_day,
    startTime:     row.start_time ? row.start_time.slice(0, 5) : undefined, // trim seconds
    endTime:       row.end_time   ? row.end_time.slice(0, 5)   : undefined,
    label:         row.label,
    recurring:     row.recurring || undefined,
    recurringDays: (row.recurring_days ?? undefined) as DayOfWeek[] | undefined,
  };
}

function availabilityToRow(
  vendorId: string,
  a: VendorAvailability,
): Omit<VendorAvailabilityRow, 'created_at' | 'updated_at'> {
  const weekly_rules: Record<string, { bookable: boolean; openTime: string; closeTime: string }> = {};
  for (let d = 0; d <= 6; d++) {
    const rule = a.weeklyRules[d as DayOfWeek];
    weekly_rules[String(d)] = {
      bookable:  rule.bookable,
      openTime:  rule.openTime,
      closeTime: rule.closeTime,
    };
  }
  return {
    vendor_id:           vendorId,
    weekly_rules,
    slot_length_minutes: a.slotLengthMinutes,
    capacity_per_slot:   a.capacityPerSlot,
    service_mode_rules:  {
      shopVisitsEnabled:     a.serviceModeRules.shopVisitsEnabled,
      mobileServiceEnabled:  a.serviceModeRules.mobileServiceEnabled,
      sameDayBookingEnabled: a.serviceModeRules.sameDayBookingEnabled,
      sameDayLeadHours:      a.serviceModeRules.sameDayLeadHours,
    },
    published_at:  new Date().toISOString(),
  };
}

function blockedPeriodToRow(
  vendorId: string,
  b: BlockedPeriod,
): Omit<BlockedPeriodRow, 'created_at' | 'updated_at'> {
  return {
    id:             b.id,
    vendor_id:      vendorId,
    date:           b.date || null,
    all_day:        b.allDay,
    start_time:     b.startTime ?? null,
    end_time:       b.endTime ?? null,
    label:          b.label,
    recurring:      b.recurring ?? false,
    recurring_days: (b.recurringDays as number[] | undefined) ?? null,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface AvailabilityValidationError {
  field: string;
  message: string;
}

export function validateAvailability(a: VendorAvailability): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];

  const VALID_SLOT_LENGTHS: SlotLengthMinutes[] = [15, 30, 45, 60, 90, 120];
  if (!VALID_SLOT_LENGTHS.includes(a.slotLengthMinutes)) {
    errors.push({ field: 'slotLengthMinutes', message: `Slot length must be one of: ${VALID_SLOT_LENGTHS.join(', ')} minutes.` });
  }

  if (!Number.isInteger(a.capacityPerSlot) || a.capacityPerSlot < 1) {
    errors.push({ field: 'capacityPerSlot', message: 'Capacity per slot must be at least 1.' });
  }

  for (let d = 0; d <= 6; d++) {
    const rule = a.weeklyRules[d as DayOfWeek];
    if (!rule.bookable) continue;
    if (timeToMinutes(rule.openTime) >= timeToMinutes(rule.closeTime)) {
      errors.push({
        field: `weeklyRules.${d}`,
        message: `Close time must be after open time for ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]}.`,
      });
    }
  }

  for (const bp of a.blockedPeriods) {
    if (!bp.allDay) {
      if (!bp.startTime || !bp.endTime) {
        errors.push({ field: `blockedPeriods.${bp.id}`, message: `Blocked period "${bp.label}" must have start and end times when not all-day.` });
        continue;
      }
      if (timeToMinutes(bp.startTime) >= timeToMinutes(bp.endTime)) {
        errors.push({ field: `blockedPeriods.${bp.id}`, message: `Blocked period "${bp.label}" end time must be after start time.` });
      }
    }
  }

  // Overlap check among blocked periods for the same date
  const byDate: Record<string, BlockedPeriod[]> = {};
  for (const bp of a.blockedPeriods) {
    if (!bp.date) continue;
    if (!byDate[bp.date]) byDate[bp.date] = [];
    byDate[bp.date].push(bp);
  }
  for (const [date, periods] of Object.entries(byDate)) {
    const timed = periods.filter((p) => !p.allDay && p.startTime && p.endTime);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        const a = timed[i];
        const b = timed[j];
        const aStart = timeToMinutes(a.startTime!);
        const aEnd   = timeToMinutes(a.endTime!);
        const bStart = timeToMinutes(b.startTime!);
        const bEnd   = timeToMinutes(b.endTime!);
        if (aStart < bEnd && aEnd > bStart) {
          errors.push({
            field: `blockedPeriods.${a.id}`,
            message: `Blocked periods "${a.label}" and "${b.label}" overlap on ${date}.`,
          });
        }
      }
    }
  }

  return errors;
}

// ── Conflict detection (returns affected booking IDs before destructive changes) ─

export interface AvailabilityConflict {
  bookingId:       string;
  appointmentDate: string;
  appointmentTime: string;
  status:          string;
}

/**
 * Returns pending/confirmed bookings that fall in newly-closed/blocked windows.
 * Called before a destructive availability save so the FE can warn the vendor.
 * NEVER deletes bookings.
 */
export async function detectAvailabilityConflicts(
  vendorId: string,
  nextAvailability: VendorAvailability,
): Promise<AvailabilityConflict[]> {
  if (!isSupabaseConfigured || !supabase) {
    return []; // demo mode — no conflicts
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, appointment_date, appointment_time, status')
    .eq('vendor_id', vendorId)
    .in('status', ['pending', 'confirmed'])
    .not('appointment_date', 'is', null)
    .not('appointment_time', 'is', null);

  if (error || !data) return [];

  const conflicts: AvailabilityConflict[] = [];

  for (const booking of data as { id: string; appointment_date: string; appointment_time: string; status: string }[]) {
    const date = booking.appointment_date;
    const time = booking.appointment_time; // "HH:MM"
    if (!date || !time) continue;

    const dateObj = new Date(date + 'T00:00:00');
    const dow = dateObj.getDay() as DayOfWeek;
    const rule = nextAvailability.weeklyRules[dow];

    // Closed day
    if (!rule.bookable) {
      conflicts.push({ bookingId: booking.id, appointmentDate: date, appointmentTime: time, status: booking.status });
      continue;
    }

    // All-day block
    const allDayBlock = nextAvailability.blockedPeriods.find(
      (b) =>
        b.allDay &&
        (b.date === date ||
          (b.recurring && b.recurringDays?.includes(dow) && b.date <= date)),
    );
    if (allDayBlock) {
      conflicts.push({ bookingId: booking.id, appointmentDate: date, appointmentTime: time, status: booking.status });
      continue;
    }

    // Outside open hours
    const openMins  = timeToMinutes(rule.openTime);
    const closeMins = timeToMinutes(rule.closeTime);
    const slotMins  = timeToMinutes(time);
    const slotEnd   = slotMins + nextAvailability.slotLengthMinutes;
    if (slotMins < openMins || slotEnd > closeMins) {
      conflicts.push({ bookingId: booking.id, appointmentDate: date, appointmentTime: time, status: booking.status });
      continue;
    }

    // Time-ranged block
    const timeBlock = nextAvailability.blockedPeriods.find((b) => {
      if (b.allDay || !b.startTime || !b.endTime) return false;
      const dateMatch  = b.date === date;
      const recurMatch = b.recurring && b.recurringDays?.includes(dow) && b.date <= date;
      if (!dateMatch && !recurMatch) return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd   = timeToMinutes(b.endTime);
      return slotMins < bEnd && slotEnd > bStart;
    });
    if (timeBlock) {
      conflicts.push({ bookingId: booking.id, appointmentDate: date, appointmentTime: time, status: booking.status });
    }
  }

  return conflicts;
}

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Loads vendor availability.
 * When vendorId is omitted, resolves to the current auth user's vendor.
 * Falls back to makeDefaultAvailability() in demo mode.
 */
export async function loadVendorAvailability(vendorId?: string): Promise<VendorAvailability> {
  const ownerId = useAuthStore.getState().session?.userId;

  if (!isSupabaseConfigured || !supabase) {
    // Demo fallback: check if demo store has an availability for this vendor
    const demoStore = useDemoDataStore.getState();
    const resolvedVendorId = vendorId
      ?? demoStore.vendors.find((v) => v.ownerId === ownerId)?.id;
    if (resolvedVendorId) {
      const demoAvail = demoStore.vendorAvailabilities?.[resolvedVendorId];
      if (demoAvail) return demoAvail;
    }
    return makeDefaultAvailability();
  }

  let resolvedVendorId = vendorId;
  if (!resolvedVendorId) {
    if (!ownerId) return makeDefaultAvailability();
    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('id')
      .eq('owner_id', ownerId)
      .maybeSingle();
    resolvedVendorId = vendorRow?.id;
    if (!resolvedVendorId) return makeDefaultAvailability();
  }

  const [availResult, blockedResult] = await Promise.all([
    supabase
      .from('vendor_availability')
      .select('*')
      .eq('vendor_id', resolvedVendorId)
      .maybeSingle(),
    supabase
      .from('vendor_blocked_periods')
      .select('*')
      .eq('vendor_id', resolvedVendorId)
      .order('date', { ascending: true }),
  ]);

  if (availResult.error) throw dbError(availResult.error, 'Load availability settings');
  if (blockedResult.error) throw dbError(blockedResult.error, 'Load blocked periods');

  if (!availResult.data) return makeDefaultAvailability();

  return rowToAvailability(
    availResult.data as unknown as VendorAvailabilityRow,
    (blockedResult.data ?? []) as unknown as BlockedPeriodRow[],
  );
}

// ── Save ──────────────────────────────────────────────────────────────────────

export interface SaveAvailabilityResult {
  availability: VendorAvailability;
  conflicts:    AvailabilityConflict[];
}

/**
 * Upserts the full availability (settings row + blocked periods diff).
 * Returns any booking conflicts caused by the new configuration.
 * Conflicts are warnings only — save still proceeds. The caller decides
 * whether to surface them or abort based on product requirements.
 */
export async function saveVendorAvailability(
  availability: VendorAvailability,
  vendorId?: string,
): Promise<SaveAvailabilityResult> {
  const errors = validateAvailability(availability);
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join(' '));
  }

  const ownerId = useAuthStore.getState().session?.userId;

  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: persist to demo store
    const demoStore = useDemoDataStore.getState();
    const resolvedId = vendorId
      ?? demoStore.vendors.find((v) => v.ownerId === ownerId)?.id;
    if (resolvedId) {
      demoStore.saveVendorAvailability(resolvedId, {
        ...availability,
        publishedAt: new Date().toISOString(),
      });
    }
    return { availability: { ...availability, publishedAt: new Date().toISOString() }, conflicts: [] };
  }

  let resolvedVendorId = vendorId;
  if (!resolvedVendorId) {
    if (!ownerId) throw new Error('Authentication required to save availability.');
    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('id')
      .eq('owner_id', ownerId)
      .maybeSingle();
    resolvedVendorId = vendorRow?.id;
    if (!resolvedVendorId) throw new Error('No vendor record found for the current user.');
  }

  // Detect conflicts BEFORE saving so FE can warn the vendor
  const conflicts = await detectAvailabilityConflicts(resolvedVendorId, availability);

  // Upsert the settings row
  const settingsPayload = availabilityToRow(resolvedVendorId, availability);
  const { error: settingsError } = await supabase
    .from('vendor_availability')
    .upsert(settingsPayload, { onConflict: 'vendor_id' });
  if (settingsError) throw dbError(settingsError, 'Save availability settings');

  // Diff blocked periods: load existing, then insert new, update changed, delete removed
  const { data: existingRows, error: listError } = await supabase
    .from('vendor_blocked_periods')
    .select('id')
    .eq('vendor_id', resolvedVendorId);
  if (listError) throw dbError(listError, 'List existing blocked periods');

  const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));
  const nextIds     = new Set(availability.blockedPeriods.map((b) => b.id));

  // Delete removed periods
  const removedIds = Array.from(existingIds).filter((id) => !nextIds.has(id));
  if (removedIds.length) {
    const { error: delError } = await supabase
      .from('vendor_blocked_periods')
      .delete()
      .in('id', removedIds);
    if (delError) throw dbError(delError, 'Delete removed blocked periods');
  }

  // Upsert current periods (insert new, update changed)
  if (availability.blockedPeriods.length) {
    const rows = availability.blockedPeriods.map((b) => blockedPeriodToRow(resolvedVendorId!, b));
    const { error: upsertError } = await supabase
      .from('vendor_blocked_periods')
      .upsert(rows, { onConflict: 'id' });
    if (upsertError) throw dbError(upsertError, 'Save blocked periods');
  }

  const saved: VendorAvailability = {
    ...availability,
    publishedAt: settingsPayload.published_at ?? undefined,
  };

  return { availability: saved, conflicts };
}

// ── Granular helpers (for modal actions) ─────────────────────────────────────

/**
 * Update one or more weekly day rules without touching blocked periods.
 */
export async function updateWeeklyRule(
  day: DayOfWeek,
  rule: Partial<DayRule>,
  vendorId?: string,
): Promise<void> {
  const current = await loadVendorAvailability(vendorId);
  const next: VendorAvailability = {
    ...current,
    weeklyRules: {
      ...current.weeklyRules,
      [day]: { ...current.weeklyRules[day], ...rule },
    },
  };
  await saveVendorAvailability(next, vendorId);
}

/**
 * Update slot length.
 */
export async function updateSlotLength(
  slotLengthMinutes: SlotLengthMinutes,
  vendorId?: string,
): Promise<void> {
  const current = await loadVendorAvailability(vendorId);
  await saveVendorAvailability({ ...current, slotLengthMinutes }, vendorId);
}

/**
 * Update capacity per slot.
 */
export async function updateCapacity(
  capacityPerSlot: number,
  vendorId?: string,
): Promise<void> {
  const current = await loadVendorAvailability(vendorId);
  await saveVendorAvailability({ ...current, capacityPerSlot }, vendorId);
}

/**
 * Update service-mode rules.
 */
export async function updateServiceModeRules(
  patch: Partial<ServiceModeRules>,
  vendorId?: string,
): Promise<void> {
  const current = await loadVendorAvailability(vendorId);
  await saveVendorAvailability(
    { ...current, serviceModeRules: { ...current.serviceModeRules, ...patch } },
    vendorId,
  );
}

/**
 * Add a blocked period.
 */
export async function addBlockedPeriod(
  period: BlockedPeriod,
  vendorId?: string,
): Promise<{ conflicts: AvailabilityConflict[] }> {
  const current = await loadVendorAvailability(vendorId);
  const next: VendorAvailability = {
    ...current,
    blockedPeriods: [...current.blockedPeriods, period],
  };
  const { conflicts } = await saveVendorAvailability(next, vendorId);
  return { conflicts };
}

/**
 * Remove a blocked period by id.
 */
export async function removeBlockedPeriod(
  id: string,
  vendorId?: string,
): Promise<void> {
  const current = await loadVendorAvailability(vendorId);
  const next: VendorAvailability = {
    ...current,
    blockedPeriods: current.blockedPeriods.filter((b) => b.id !== id),
  };
  await saveVendorAvailability(next, vendorId);
}
