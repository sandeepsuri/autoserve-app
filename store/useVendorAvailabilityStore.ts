/**
 * Vendor Availability Store
 *
 * Single source of truth for vendor availability data across:
 * - Onboarding step (Ticket 1)
 * - Adjust availability modal (Tickets 2–4)
 * - Client booking schedule (Ticket 5)
 *
 * Backend persistence is OUT OF SCOPE. State lives in Zustand with
 * AsyncStorage persistence, mirroring the pattern in useVendorOnboardingStore.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// --- Domain types -----------------------------------------------------------

/** 0 = Sunday … 6 = Saturday (matches JS Date.getDay()) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * A time string in "HH:MM" 24-hour format, e.g. "08:30", "17:00".
 */
export type TimeString = string;

/**
 * One contiguous bookable block within a day.
 * May have a label/note for UI context.
 */
export interface TimeBlock {
  id: string;
  startTime: TimeString; // "HH:MM"
  endTime: TimeString;   // "HH:MM"
  label?: string;
}

/**
 * The recurring rules for a single day of the week.
 */
export interface DayRule {
  /** Whether the vendor takes bookings on this weekday */
  bookable: boolean;
  /** Opening time e.g. "08:30". Only relevant when bookable=true */
  openTime: TimeString;
  /** Closing time e.g. "17:30". Only relevant when bookable=true */
  closeTime: TimeString;
}

/**
 * Slot length options (minutes).
 */
export type SlotLengthMinutes = 15 | 30 | 45 | 60 | 90 | 120;

/**
 * A blocked-time entry that overrides weekly rules for a specific period.
 * allDay=true means the whole date is closed.
 */
export interface BlockedPeriod {
  id: string;
  date: string;         // ISO "YYYY-MM-DD"
  allDay: boolean;
  startTime?: TimeString;
  endTime?: TimeString;
  label: string;        // e.g. "Lunch", "Shop maintenance"
  recurring?: boolean;  // daily recurrence (e.g. lunch break every weekday)
  recurringDays?: DayOfWeek[];
}

/**
 * Quick, day-scoped overrides that expire at midnight unless saved to weekly rules.
 */
export interface QuickControls {
  /** Date the controls apply to: ISO "YYYY-MM-DD" */
  date: string;
  pauseSameDayBooking: boolean;
  addMobileBuffer: boolean;         // 30-min gap between mobile jobs
  openOvertimeSlot: boolean;        // one extra booking after normal hours
  /** Close the selected day entirely (overrides weekly rule for one day) */
  closeDay: boolean;
}

/**
 * Service-mode rules that travel alongside the weekly schedule.
 */
export interface ServiceModeRules {
  shopVisitsEnabled: boolean;
  mobileServiceEnabled: boolean;
  sameDayBookingEnabled: boolean;
  /** Minimum hours of lead time when sameDayBookingEnabled=true */
  sameDayLeadHours: number;
}

/**
 * The canonical vendor availability model.
 * All edits in the modal and onboarding write into this shape.
 */
export interface VendorAvailability {
  /** ISO "YYYY-MM-DD" of last publish */
  publishedAt?: string;

  /** Recurring weekly rules keyed by DayOfWeek */
  weeklyRules: Record<DayOfWeek, DayRule>;

  /** Slot length in minutes */
  slotLengthMinutes: SlotLengthMinutes;

  /** Max concurrent bookings per slot */
  capacityPerSlot: number;

  /** Blocked time overrides */
  blockedPeriods: BlockedPeriod[];

  /** Service-mode toggles */
  serviceModeRules: ServiceModeRules;

  /** Active quick controls (keyed by date ISO string, last-write wins) */
  quickControls: Record<string, QuickControls>;
}

// --- Defaults ---------------------------------------------------------------

export const DEFAULT_WEEK_RULE: DayRule = {
  bookable: false,
  openTime: '09:00',
  closeTime: '17:00',
};

export const DEFAULT_WEEKDAY_RULE: DayRule = {
  bookable: true,
  openTime: '08:30',
  closeTime: '17:30',
};

export function makeDefaultAvailability(): VendorAvailability {
  return {
    weeklyRules: {
      0: { ...DEFAULT_WEEK_RULE },                   // Sun — closed
      1: { ...DEFAULT_WEEKDAY_RULE },                // Mon
      2: { ...DEFAULT_WEEKDAY_RULE },                // Tue
      3: { ...DEFAULT_WEEKDAY_RULE },                // Wed
      4: { ...DEFAULT_WEEKDAY_RULE },                // Thu
      5: { ...DEFAULT_WEEKDAY_RULE },                // Fri
      6: { bookable: true, openTime: '09:00', closeTime: '14:00' }, // Sat — short day
    },
    slotLengthMinutes: 30,
    capacityPerSlot: 2,
    blockedPeriods: [],
    serviceModeRules: {
      shopVisitsEnabled: true,
      mobileServiceEnabled: true,
      sameDayBookingEnabled: false,
      sameDayLeadHours: 2,
    },
    quickControls: {},
  };
}

// --- Selectors / utilities --------------------------------------------------

/**
 * Parse a "HH:MM" string to total minutes since midnight.
 */
export function timeToMinutes(time: TimeString): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format total minutes since midnight to "HH:MM".
 */
export function minutesToTime(minutes: number): TimeString {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format "HH:MM" to human-readable "h:MM AM/PM".
 */
export function formatTimeDisplay(time: TimeString): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Validate that startTime < endTime.
 * Returns an error string or null.
 */
export function validateTimeRange(startTime: TimeString, endTime: TimeString): string | null {
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    return 'End time must be after start time';
  }
  return null;
}

/**
 * Derive bookable time slots for a given date and availability config.
 * Returns an array of slot start times (ISO datetime strings or "HH:MM" for display).
 */
export function deriveAvailableSlots(
  dateIso: string, // "YYYY-MM-DD"
  availability: VendorAvailability,
  bookedSlots: string[] = [], // already-booked "HH:MM" strings
): string[] {
  const date = new Date(dateIso + 'T00:00:00');
  const dow = date.getDay() as DayOfWeek;
  const rule = availability.weeklyRules[dow];

  if (!rule.bookable) return [];

  // Check for all-day block
  const allDayBlock = availability.blockedPeriods.find(
    (b) => b.date === dateIso && b.allDay,
  );
  if (allDayBlock) return [];

  // Check quick-controls close
  const qc = availability.quickControls[dateIso];
  if (qc?.closeDay) return [];

  const slotLen = availability.slotLengthMinutes;
  const openMins = timeToMinutes(rule.openTime);
  const closeMins = timeToMinutes(rule.closeTime);

  const slots: string[] = [];
  for (let t = openMins; t + slotLen <= closeMins; t += slotLen) {
    const slotTime = minutesToTime(t);
    const slotEnd = minutesToTime(t + slotLen);

    // Check if blocked by a specific period
    const blocked = availability.blockedPeriods.some((b) => {
      if (b.allDay) return false;
      if (!b.startTime || !b.endTime) return false;

      // Exact date match
      const dateMatch = b.date === dateIso;
      // Recurring weekday match
      const recurMatch = b.recurring &&
        b.recurringDays?.includes(dow) &&
        (b.date <= dateIso); // recurring from original date

      if (!dateMatch && !recurMatch) return false;

      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      const sStart = timeToMinutes(slotTime);
      const sEnd = timeToMinutes(slotEnd);

      // Overlap: slot starts before block ends AND slot ends after block starts
      return sStart < bEnd && sEnd > bStart;
    });

    if (blocked) continue;

    // Check if mobile buffer applies (skip slots fewer than 30 min apart from prior)
    if (qc?.addMobileBuffer && slots.length > 0) {
      const lastSlotMins = timeToMinutes(slots[slots.length - 1]);
      if (timeToMinutes(slotTime) - lastSlotMins < 30) continue;
    }

    // Check capacity
    const bookedCount = bookedSlots.filter((s) => s === slotTime).length;
    if (bookedCount >= availability.capacityPerSlot) continue;

    slots.push(slotTime);
  }

  // Quick controls: pause same-day booking removes all slots for today
  if (qc?.pauseSameDayBooking) {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (dateIso === todayIso) return [];
  }

  return slots;
}

/**
 * Check whether a date is open (has at least one available slot).
 */
export function isDateOpen(
  dateIso: string,
  availability: VendorAvailability,
  bookedSlots: string[] = [],
): boolean {
  return deriveAvailableSlots(dateIso, availability, bookedSlots).length > 0;
}

/**
 * Check whether a date is fully booked (bookable but all slots at capacity).
 */
export function isDateFullyBooked(
  dateIso: string,
  availability: VendorAvailability,
  bookedSlots: string[] = [],
): boolean {
  const date = new Date(dateIso + 'T00:00:00');
  const dow = date.getDay() as DayOfWeek;
  const rule = availability.weeklyRules[dow];
  if (!rule.bookable) return false;

  const allSlotsIgnoringCapacity = deriveAvailableSlots(dateIso, {
    ...availability,
    capacityPerSlot: 999,
  });
  if (allSlotsIgnoringCapacity.length === 0) return false;

  const withCapacity = deriveAvailableSlots(dateIso, availability, bookedSlots);
  return withCapacity.length === 0;
}

/**
 * Count total weekly slots given a DayRule range and slot length.
 */
export function countWeeklySlots(availability: VendorAvailability): number {
  let total = 0;
  for (let d = 0; d <= 6; d++) {
    const rule = availability.weeklyRules[d as DayOfWeek];
    if (!rule.bookable) continue;
    const openMins = timeToMinutes(rule.openTime);
    const closeMins = timeToMinutes(rule.closeTime);
    const slotsPerDay = Math.max(
      0,
      Math.floor((closeMins - openMins) / availability.slotLengthMinutes),
    ) * availability.capacityPerSlot;
    total += slotsPerDay;
  }
  return total;
}

// --- Store interface --------------------------------------------------------

interface VendorAvailabilityState {
  availability: VendorAvailability;
  /** Draft being edited in the modal (not yet saved) */
  draft: VendorAvailability | null;
  /** Which date is focused in the Adjust Availability modal */
  focusedDate: string | null;

  // Availability actions
  setAvailability: (a: VendorAvailability) => void;
  patchWeeklyRule: (day: DayOfWeek, rule: Partial<DayRule>) => void;
  patchSlotLength: (len: SlotLengthMinutes) => void;
  patchCapacity: (cap: number) => void;
  patchServiceModeRules: (rules: Partial<ServiceModeRules>) => void;
  addBlockedPeriod: (period: BlockedPeriod) => void;
  removeBlockedPeriod: (id: string) => void;
  setQuickControls: (date: string, controls: Partial<QuickControls>) => void;

  // Draft (modal) actions
  openDraft: () => void;
  patchDraftWeeklyRule: (day: DayOfWeek, rule: Partial<DayRule>) => void;
  patchDraftSlotLength: (len: SlotLengthMinutes) => void;
  patchDraftCapacity: (cap: number) => void;
  patchDraftServiceModeRules: (rules: Partial<ServiceModeRules>) => void;
  addDraftBlockedPeriod: (period: BlockedPeriod) => void;
  removeDraftBlockedPeriod: (id: string) => void;
  setDraftQuickControls: (date: string, controls: Partial<QuickControls>) => void;
  saveDraft: () => void;
  discardDraft: () => void;

  setFocusedDate: (date: string | null) => void;
  reset: () => void;
}

// --- Store ------------------------------------------------------------------

export const useVendorAvailabilityStore = create<VendorAvailabilityState>()(
  persist(
    (set, get) => ({
      availability: makeDefaultAvailability(),
      draft: null,
      focusedDate: null,

      // --- Published availability mutations ---
      setAvailability: (availability) => set({ availability }),

      patchWeeklyRule: (day, rule) =>
        set((s) => ({
          availability: {
            ...s.availability,
            weeklyRules: {
              ...s.availability.weeklyRules,
              [day]: { ...s.availability.weeklyRules[day], ...rule },
            },
          },
        })),

      patchSlotLength: (len) =>
        set((s) => ({
          availability: { ...s.availability, slotLengthMinutes: len },
        })),

      patchCapacity: (cap) =>
        set((s) => ({
          availability: { ...s.availability, capacityPerSlot: cap },
        })),

      patchServiceModeRules: (rules) =>
        set((s) => ({
          availability: {
            ...s.availability,
            serviceModeRules: { ...s.availability.serviceModeRules, ...rules },
          },
        })),

      addBlockedPeriod: (period) =>
        set((s) => ({
          availability: {
            ...s.availability,
            blockedPeriods: [...s.availability.blockedPeriods, period],
          },
        })),

      removeBlockedPeriod: (id) =>
        set((s) => ({
          availability: {
            ...s.availability,
            blockedPeriods: s.availability.blockedPeriods.filter((b) => b.id !== id),
          },
        })),

      setQuickControls: (date, controls) =>
        set((s) => {
          const existing = s.availability.quickControls[date];
          const merged: QuickControls = {
            date,
            pauseSameDayBooking: existing?.pauseSameDayBooking ?? false,
            addMobileBuffer: existing?.addMobileBuffer ?? false,
            openOvertimeSlot: existing?.openOvertimeSlot ?? false,
            closeDay: existing?.closeDay ?? false,
            ...controls,
          };
          return {
            availability: {
              ...s.availability,
              quickControls: { ...s.availability.quickControls, [date]: merged },
            },
          };
        }),

      // --- Draft mutations (modal) ---
      openDraft: () => set((s) => ({ draft: { ...s.availability } })),

      patchDraftWeeklyRule: (day, rule) =>
        set((s) => {
          if (!s.draft) return {};
          return {
            draft: {
              ...s.draft,
              weeklyRules: {
                ...s.draft.weeklyRules,
                [day]: { ...s.draft.weeklyRules[day], ...rule },
              },
            },
          };
        }),

      patchDraftSlotLength: (len) =>
        set((s) => s.draft ? { draft: { ...s.draft, slotLengthMinutes: len } } : {}),

      patchDraftCapacity: (cap) =>
        set((s) => s.draft ? { draft: { ...s.draft, capacityPerSlot: cap } } : {}),

      patchDraftServiceModeRules: (rules) =>
        set((s) => {
          if (!s.draft) return {};
          return {
            draft: {
              ...s.draft,
              serviceModeRules: { ...s.draft.serviceModeRules, ...rules },
            },
          };
        }),

      addDraftBlockedPeriod: (period) =>
        set((s) => {
          if (!s.draft) return {};
          return {
            draft: {
              ...s.draft,
              blockedPeriods: [...s.draft.blockedPeriods, period],
            },
          };
        }),

      removeDraftBlockedPeriod: (id) =>
        set((s) => {
          if (!s.draft) return {};
          return {
            draft: {
              ...s.draft,
              blockedPeriods: s.draft.blockedPeriods.filter((b) => b.id !== id),
            },
          };
        }),

      setDraftQuickControls: (date, controls) =>
        set((s) => {
          if (!s.draft) return {};
          const existing = s.draft.quickControls[date];
          const merged: QuickControls = {
            date,
            pauseSameDayBooking: existing?.pauseSameDayBooking ?? false,
            addMobileBuffer: existing?.addMobileBuffer ?? false,
            openOvertimeSlot: existing?.openOvertimeSlot ?? false,
            closeDay: existing?.closeDay ?? false,
            ...controls,
          };
          return {
            draft: {
              ...s.draft,
              quickControls: { ...s.draft.quickControls, [date]: merged },
            },
          };
        }),

      saveDraft: () =>
        set((s) => {
          if (!s.draft) return {};
          return {
            availability: { ...s.draft, publishedAt: new Date().toISOString() },
            draft: null,
          };
        }),

      discardDraft: () => set({ draft: null }),

      setFocusedDate: (date) => set({ focusedDate: date }),

      reset: () => set({ availability: makeDefaultAvailability(), draft: null, focusedDate: null }),
    }),
    {
      name: 'autoserve-vendor-availability',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
