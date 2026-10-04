/**
 * Ticket 1 — Vendor onboarding availability setup step
 *
 * Placed AFTER services and BEFORE review in the VENDOR_ONBOARDING_STEPS array.
 * Captures: open days, open/close times, slot length, capacity, service-mode rules.
 * Continue is disabled until at least one day is bookable with a valid time range.
 * Back nav preserves entered values (state lives in useVendorAvailabilityStore).
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getPrevStep, getNextStep } from '@/lib/vendor-onboarding-steps';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import {
  DAY_FULL_LABELS,
  DayOfWeek,
  DayRule,
  SlotLengthMinutes,
  formatTimeDisplay,
  validateTimeRange,
  countWeeklySlots,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';
import { useRouter } from 'expo-router';

const SLOT_LENGTH_OPTIONS: SlotLengthMinutes[] = [15, 30, 45, 60, 90, 120];
const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6];

// Simple time picker — a scrollable list of HH:MM values at 30-min increments
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 22) TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}

function TimeSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={ts.timeSelectorWrap}>
      <Text style={ts.timeSelectorLabel}>{label}</Text>
      <Pressable onPress={() => setOpen((v) => !v)} style={ts.timeSelectorBtn}>
        <Text style={ts.timeSelectorValue}>{formatTimeDisplay(value)}</Text>
        <Text style={ts.timeSelectorChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <ScrollView style={ts.timeDropdown} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                onChange(t);
                setOpen(false);
              }}
              style={[ts.timeOption, value === t && ts.timeOptionActive]}
            >
              <Text style={[ts.timeOptionText, value === t && ts.timeOptionActiveText]}>
                {formatTimeDisplay(t)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const ts = StyleSheet.create({
  timeSelectorWrap: { flex: 1, gap: spacing.xs },
  timeSelectorLabel: { ...typography.caption, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  timeSelectorBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  timeSelectorValue: { ...typography.labelMd, color: colors.textPrimary },
  timeSelectorChevron: { ...typography.caption, color: colors.textSecondary },
  timeDropdown: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  timeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center' as const,
  },
  timeOptionActive: { backgroundColor: colors.surfaceBrand },
  timeOptionText: { ...typography.bodyMd, color: colors.textPrimary },
  timeOptionActiveText: { color: colors.textInverse },
});

export default function AvailabilityStep() {
  const router = useRouter();
  const { patchDraft } = useVendorOnboardingStore();
  const {
    availability,
    patchWeeklyRule,
    patchSlotLength,
    patchCapacity,
    patchServiceModeRules,
  } = useVendorAvailabilityStore();

  const { weeklyRules, slotLengthMinutes, capacityPerSlot, serviceModeRules } = availability;

  const ORDERED_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

  // Validate: at least one open day with valid time range
  const validDays = ORDERED_DAYS.filter((d) => {
    const rule = weeklyRules[d];
    if (!rule.bookable) return false;
    return validateTimeRange(rule.openTime, rule.closeTime) === null;
  });

  const canContinue = validDays.length > 0;
  const weeklySlots = countWeeklySlots(availability);

  const handleBack = () => {
    const prev = getPrevStep('availability');
    router.replace(prev?.route ?? '/(auth)/vendor-onboarding/services');
  };

  const handleContinue = () => {
    if (!canContinue) return;
    // Availability lives in useVendorAvailabilityStore and is persisted by
    // submitVendorOnboarding once the vendor record exists. Do NOT write to the
    // backend here — the vendor row doesn't exist yet during onboarding.
    patchDraft({ availabilityConfigured: true });
    const next = getNextStep('availability');
    router.replace(next?.route ?? '/(auth)/vendor-onboarding/review');
  };

  const handleSaveExit = () => {
    router.replace('/(auth)/role');
  };

  const toggleDay = (day: DayOfWeek) => {
    const rule = weeklyRules[day];
    patchWeeklyRule(day, { bookable: !rule.bookable });
  };

  const patchTime = (day: DayOfWeek, field: keyof Pick<DayRule, 'openTime' | 'closeTime'>, value: string) => {
    patchWeeklyRule(day, { [field]: value });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader
          title="Set your availability"
          subtitle="Define your weekly hours before customers can request slots. You can adjust any time later."
          onBack={handleBack}
        />
        <OnboardingProgress stepId="availability" />

        {/* Summary card */}
        <AppCard style={styles.card}>
          <SectionHeader title="Schedule summary" actionLabel={`${validDays.length} open days`} />
          <View style={styles.statsRow}>
            <StatPill label="Open days" value={`${validDays.length}`} tone="brand" />
            <StatPill label="Weekly slots" value={`${weeklySlots}`} tone="accent" />
            <StatPill label="Slot length" value={`${slotLengthMinutes}m`} tone="muted" />
          </View>
          <Text style={styles.hint}>
            Customers will only see dates and times derived from these rules. Adjust them any time from the Bookings tab.
          </Text>
        </AppCard>

        {/* Day-by-day rules */}
        <AppCard style={styles.card}>
          <SectionHeader title="Open days & hours" actionLabel="Required" />
          {ORDERED_DAYS.map((day) => {
            const rule = weeklyRules[day];
            const timeError = rule.bookable
              ? validateTimeRange(rule.openTime, rule.closeTime)
              : null;
            return (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayTopRow}>
                  <View style={styles.dayLabelBlock}>
                    <Text style={styles.dayLabel}>{DAY_FULL_LABELS[day]}</Text>
                    {!rule.bookable ? (
                      <Text style={styles.dayStatus}>Closed</Text>
                    ) : null}
                  </View>
                  <Switch
                    value={rule.bookable}
                    onValueChange={() => toggleDay(day)}
                    trackColor={{ true: colors.surfaceBrand, false: colors.borderStrong }}
                    thumbColor={colors.bgElevated}
                    accessibilityLabel={`Toggle ${DAY_FULL_LABELS[day]}`}
                  />
                </View>
                {rule.bookable ? (
                  <View style={styles.timePair}>
                    <TimeSelector
                      label="Open"
                      value={rule.openTime}
                      onChange={(t) => patchTime(day, 'openTime', t)}
                    />
                    <TimeSelector
                      label="Close"
                      value={rule.closeTime}
                      onChange={(t) => patchTime(day, 'closeTime', t)}
                    />
                  </View>
                ) : null}
                {timeError ? (
                  <Text style={styles.timeError}>{timeError}</Text>
                ) : null}
              </View>
            );
          })}
        </AppCard>

        {/* Slot length */}
        <AppCard style={styles.card}>
          <SectionHeader title="Slot length" actionLabel="How long each booking window is" />
          <View style={styles.chipRow}>
            {SLOT_LENGTH_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => patchSlotLength(opt)}
                style={[styles.optionChip, slotLengthMinutes === opt && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, slotLengthMinutes === opt && styles.optionChipTextActive]}>
                  {opt}m
                </Text>
              </Pressable>
            ))}
          </View>
        </AppCard>

        {/* Capacity */}
        <AppCard style={styles.card}>
          <SectionHeader title="Capacity per slot" actionLabel="Concurrent bookings allowed" />
          <View style={styles.chipRow}>
            {CAPACITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => patchCapacity(opt)}
                style={[styles.optionChip, capacityPerSlot === opt && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, capacityPerSlot === opt && styles.optionChipTextActive]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </AppCard>

        {/* Service mode rules */}
        <AppCard style={styles.card}>
          <SectionHeader title="Booking modes" actionLabel="Service rules" />
          <ToggleRow
            label="Shop visits"
            description="Customers come to your fixed location"
            value={serviceModeRules.shopVisitsEnabled}
            onToggle={() => patchServiceModeRules({ shopVisitsEnabled: !serviceModeRules.shopVisitsEnabled })}
          />
          <ToggleRow
            label="Mobile service"
            description="You travel to the customer's location"
            value={serviceModeRules.mobileServiceEnabled}
            onToggle={() => patchServiceModeRules({ mobileServiceEnabled: !serviceModeRules.mobileServiceEnabled })}
          />
          <ToggleRow
            label="Same-day booking"
            description={`Min ${serviceModeRules.sameDayLeadHours}h lead time required`}
            value={serviceModeRules.sameDayBookingEnabled}
            onToggle={() => patchServiceModeRules({ sameDayBookingEnabled: !serviceModeRules.sameDayBookingEnabled })}
          />
        </AppCard>

        {!canContinue ? (
          <View style={styles.validationBox}>
            <Text style={styles.validationText}>
              Mark at least one day as open with a valid time range (close must be after open) to continue.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label="Continue"
          disabled={!canContinue}
          onPress={handleContinue}
        />
        <AppButton
          label="Save & exit"
          variant="ghost"
          onPress={handleSaveExit}
        />
      </View>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.surfaceBrand, false: colors.borderStrong }}
        thumbColor={colors.bgElevated}
        accessibilityLabel={label}
      />
    </View>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'accent' | 'muted';
}) {
  return (
    <View
      style={[
        styles.statPill,
        tone === 'brand' && styles.statBrand,
        tone === 'accent' && styles.statAccent,
        tone === 'muted' && styles.statMuted,
      ]}
    >
      <Text style={[styles.statValue, tone !== 'muted' && styles.statValueLight]}>{value}</Text>
      <Text style={[styles.statLabel, tone !== 'muted' && styles.statLabelLight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    padding: spacing.page,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  footer: {
    padding: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  card: {
    gap: spacing.md,
  },
  hint: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  statBrand: { backgroundColor: colors.bgStrong },
  statAccent: { backgroundColor: colors.surfaceSubtleOrange },
  statMuted: { backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault },
  statValue: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  statValueLight: { color: colors.textInverse },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statLabelLight: { color: '#CBD5E1' },

  dayRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dayLabelBlock: {
    gap: spacing.xs,
  },
  dayLabel: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  dayStatus: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  timePair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeError: {
    ...typography.caption,
    color: colors.danger,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    minHeight: 44,
    minWidth: 56,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionChipActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  optionChipText: {
    ...typography.labelMd,
    color: colors.textSecondary,
  },
  optionChipTextActive: {
    color: colors.textInverse,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleLabel: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  toggleDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  validationBox: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  validationText: {
    ...typography.bodyMd,
    color: colors.pending,
  },
});
