/**
 * Ticket 3 — Change date tab
 *
 * Full month calendar (not horizontal scroll) with day states:
 *   selected, available, limited (≤50% capacity remaining), closed, blocked.
 *
 * Tapping a date updates the focusedDate in the store.
 * Month navigation via prev/next buttons.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  deriveAvailableSlots,
  formatTimeDisplay,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';

const MONTH_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type DayState = 'selected' | 'available' | 'limited' | 'closed' | 'blocked';

function getDayState(
  dateIso: string,
  focusedDate: string | null,
  availability: ReturnType<typeof useVendorAvailabilityStore.getState>['availability'],
): DayState {
  if (focusedDate === dateIso) return 'selected';

  // Check for all-day block
  const allDay = availability.blockedPeriods.find((b) => b.date === dateIso && b.allDay);
  if (allDay) return 'blocked';

  const slots = deriveAvailableSlots(dateIso, availability);
  if (slots.length === 0) return 'closed';

  // Limited = fewer slots than max possible (capacity / 2)
  const maxPossible = deriveAvailableSlots(dateIso, { ...availability, capacityPerSlot: 999 }).length;
  if (slots.length <= maxPossible / 2) return 'limited';

  return 'available';
}

export function ChangeDateTab() {
  const { availability, draft, focusedDate, setFocusedDate } = useVendorAvailabilityStore();
  const activeAvailability = draft ?? availability;

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Build calendar grid for the viewed month (Mon–Sun week start)
  const firstDay = new Date(viewYear, viewMonth, 1);
  // 0=Sun in JS; we want Mon=0 for display
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon-based offset
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Pad with nulls for the first row
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectedSlots = focusedDate
    ? deriveAvailableSlots(focusedDate, activeAvailability)
    : [];

  return (
    <>
      <AppCard style={styles.card}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <Pressable
            onPress={prevMonth}
            style={styles.navBtn}
            hitSlop={8}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            onPress={nextMonth}
            style={styles.navBtn}
            hitSlop={8}
            accessibilityLabel="Next month"
          >
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        {/* Day-of-week headers (Mon–Sun) */}
        <View style={styles.dayGrid}>
          {MONTH_DAY_LABELS.map((l, i) => (
            <View key={i} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{l}</Text>
            </View>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <View key={`pad-${i}`} style={styles.dayCell} />;
            }

            const dateIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isPast = new Date(dateIso) < new Date(today.toISOString().slice(0, 10));
            const state = isPast ? 'closed' : getDayState(dateIso, focusedDate, activeAvailability);

            return (
              <Pressable
                key={dateIso}
                onPress={() => !isPast && setFocusedDate(dateIso)}
                style={[
                  styles.dayCell,
                  state === 'selected' && styles.dayCellSelected,
                  state === 'closed' && styles.dayCellClosed,
                  state === 'blocked' && styles.dayCellBlocked,
                  state === 'limited' && styles.dayCellLimited,
                  isPast && styles.dayCellPast,
                ]}
                disabled={isPast}
                accessibilityLabel={`${dateIso} — ${state}`}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.dayCellText,
                    state === 'selected' && styles.dayCellTextSelected,
                    state === 'limited' && styles.dayCellTextLimited,
                    (state === 'closed' || isPast) && styles.dayCellTextClosed,
                    state === 'blocked' && styles.dayCellTextBlocked,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendItem color={colors.surfaceBrand} label="Selected" />
          <LegendItem color={colors.bgElevated} border label="Available" />
          <LegendItem color={colors.surfaceSubtleOrange} label="Limited" />
          <LegendItem color={colors.bgBase} striped label="Closed" />
        </View>
      </AppCard>

      {focusedDate ? (
        <AppCard style={styles.card}>
          <Text style={styles.selectedDateTitle}>
            {new Date(focusedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.selectedDateSub}>
            {selectedSlots.length > 0
              ? `${selectedSlots.length} slots available`
              : 'No open slots on this date'}
          </Text>
          {selectedSlots.length > 0 ? (
            <View style={styles.slotPreview}>
              {selectedSlots.slice(0, 4).map((slot) => (
                <View key={slot} style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>{formatTimeDisplay(slot)}</Text>
                </View>
              ))}
              {selectedSlots.length > 4 ? (
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>+{selectedSlots.length - 4} more</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </AppCard>
      ) : (
        <View style={styles.emptyNotice}>
          <Text style={styles.emptyNoticeText}>Tap a date above to see available slots and make adjustments.</Text>
        </View>
      )}
    </>
  );
}

function LegendItem({
  color,
  label,
  border,
  striped,
}: {
  color: string;
  label: string;
  border?: boolean;
  striped?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color },
          border && { borderWidth: 1, borderColor: colors.borderDefault },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    ...typography.titleSm,
    color: colors.surfaceBrand,
    lineHeight: 22,
  },
  monthLabel: {
    ...typography.titleSm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayHeaderCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  dayHeaderText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    marginBottom: 4,
  },
  dayCellSelected: {
    backgroundColor: colors.surfaceBrand,
    borderColor: colors.surfaceBrand,
  },
  dayCellClosed: {
    backgroundColor: colors.bgBase,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  dayCellBlocked: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
  },
  dayCellLimited: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderColor: '#FED7AA',
  },
  dayCellPast: {
    opacity: 0.3,
  },
  dayCellText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  dayCellTextSelected: {
    color: colors.textInverse,
  },
  dayCellTextClosed: {
    color: colors.textTertiary,
  },
  dayCellTextBlocked: {
    color: colors.pending,
  },
  dayCellTextLimited: {
    color: colors.pending,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectedDateTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  selectedDateSub: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  slotPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
  },
  slotBadgeText: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  emptyNotice: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  emptyNoticeText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
