/**
 * Ticket 3 — Quick Controls tab
 *
 * Day-scoped toggles for the focusedDate:
 *   - Pause same-day booking (hides remaining slots for today)
 *   - Add mobile buffer (30-min gap between mobile appointments)
 *   - Open overtime slot (one extra after normal hours)
 *   - Close selected day (override for this date only)
 *
 * Dangerous controls (close day) show a warning before save.
 * Clearly states that changes expire at midnight unless saved to Weekly rules.
 * Preview of client-facing slot impact shown before save.
 */

import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  deriveAvailableSlots,
  formatTimeDisplay,
  QuickControls,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';

export function QuickControlsTab() {
  const {
    availability,
    draft,
    focusedDate,
    setDraftQuickControls,
  } = useVendorAvailabilityStore();

  const activeAvailability = draft ?? availability;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Default to today if no focusedDate
  const date = focusedDate ?? todayIso;
  const existing = activeAvailability.quickControls[date];
  const qc: QuickControls = {
    date,
    pauseSameDayBooking: existing?.pauseSameDayBooking ?? false,
    addMobileBuffer: existing?.addMobileBuffer ?? false,
    openOvertimeSlot: existing?.openOvertimeSlot ?? false,
    closeDay: existing?.closeDay ?? false,
  };

  const patch = (controls: Partial<QuickControls>) => {
    setDraftQuickControls(date, controls);
  };

  // Preview: how many slots would be available after quick controls
  const slotsAfter = qc.closeDay || (qc.pauseSameDayBooking && date === todayIso)
    ? []
    : deriveAvailableSlots(date, {
        ...activeAvailability,
        quickControls: {
          ...activeAvailability.quickControls,
          [date]: qc,
        },
      });

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const isToday = date === todayIso;
  const hasDangerousControl = qc.closeDay;

  return (
    <>
      <View style={styles.dateContext}>
        <Text style={styles.dateContextLabel}>Quick controls for</Text>
        <Text style={styles.dateContextValue}>{dateLabel}</Text>
        <Text style={styles.expiryNote}>
          Quick controls expire at midnight unless saved into Weekly rules.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <ControlRow
          label="Pause same-day booking"
          description={isToday ? 'Hides all remaining slots for today only.' : 'Only applies when selected date is today.'}
          value={qc.pauseSameDayBooking}
          onToggle={() => patch({ pauseSameDayBooking: !qc.pauseSameDayBooking })}
          disabled={!isToday}
        />
        <ControlRow
          label="Add mobile buffer"
          description="Adds 30 minutes between mobile appointments on this day."
          value={qc.addMobileBuffer}
          onToggle={() => patch({ addMobileBuffer: !qc.addMobileBuffer })}
        />
        <ControlRow
          label="Open overtime slot"
          description="Allows one extra booking after normal closing time."
          value={qc.openOvertimeSlot}
          onToggle={() => patch({ openOvertimeSlot: !qc.openOvertimeSlot })}
        />
        <ControlRow
          label="Close selected day"
          description="Removes all customer-facing slots for this date. Confirmed bookings stay protected."
          value={qc.closeDay}
          onToggle={() => patch({ closeDay: !qc.closeDay })}
          dangerous
        />
      </AppCard>

      {hasDangerousControl ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Before you save</Text>
          <Text style={styles.warningBody}>
            Closing {dateLabel} will remove it from client booking entirely. Any pending requests on
            this day will no longer be visible to new customers. Confirmed bookings are not cancelled
            automatically — contact those customers separately.
          </Text>
        </View>
      ) : null}

      {/* Preview of client-facing impact */}
      <AppCard style={styles.card}>
        <Text style={styles.previewTitle}>Client schedule preview</Text>
        <Text style={styles.previewSub}>
          Customers would see {slotsAfter.length} slot{slotsAfter.length !== 1 ? 's' : ''} on {dateLabel} after these controls are saved.
        </Text>
        {slotsAfter.length > 0 ? (
          <View style={styles.slotGrid}>
            {slotsAfter.slice(0, 6).map((slot) => (
              <View key={slot} style={styles.slotBadge}>
                <Text style={styles.slotBadgeText}>{formatTimeDisplay(slot)}</Text>
              </View>
            ))}
            {slotsAfter.length > 6 ? (
              <View style={styles.slotBadge}>
                <Text style={styles.slotBadgeText}>+{slotsAfter.length - 6}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noSlotsBox}>
            <Text style={styles.noSlotsText}>No slots would be visible to customers.</Text>
          </View>
        )}
      </AppCard>
    </>
  );
}

function ControlRow({
  label,
  description,
  value,
  onToggle,
  dangerous,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  dangerous?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.controlRow, disabled && styles.controlRowDisabled]}>
      <View style={styles.controlCopy}>
        <Text style={[styles.controlLabel, dangerous && styles.controlLabelDanger]}>{label}</Text>
        <Text style={styles.controlDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: dangerous ? colors.danger : colors.surfaceBrand, false: colors.borderStrong }}
        thumbColor={colors.bgElevated}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dateContext: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  dateContextLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateContextValue: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  expiryNote: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: { gap: spacing.sm },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  controlRowDisabled: { opacity: 0.4 },
  controlCopy: { flex: 1, gap: spacing.xs },
  controlLabel: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  controlLabelDanger: { color: colors.danger },
  controlDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  warningBox: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.surfaceAccent,
  },
  warningTitle: {
    ...typography.labelLg,
    color: colors.pending,
  },
  warningBody: {
    ...typography.bodyMd,
    color: colors.pending,
  },
  previewTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  previewSub: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  slotGrid: {
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
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeText: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  noSlotsBox: {
    backgroundColor: colors.bgBase,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  noSlotsText: {
    ...typography.bodyMd,
    color: colors.textTertiary,
  },
});
