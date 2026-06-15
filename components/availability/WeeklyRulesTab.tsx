/**
 * Ticket 4 — Weekly rules tab
 *
 * Edits recurring weekly schedule:
 *   - Weekday selector (Mon–Sun) with bookable toggle per day
 *   - Time block open/close per day
 *   - Copy-to-days (apply same hours to multiple days)
 *   - Slot length picker
 *   - Capacity picker
 *   - Service-mode rules (shop visits + mobile)
 *
 * Invalid time ranges show inline errors.
 * All edits go into draft (not published until Save in the modal footer).
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  DAY_FULL_LABELS,
  DAY_LABELS,
  DayOfWeek,
  SlotLengthMinutes,
  formatTimeDisplay,
  validateTimeRange,
  countWeeklySlots,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';

const ORDERED_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
const SLOT_LENGTH_OPTIONS: SlotLengthMinutes[] = [15, 30, 45, 60, 90, 120];
const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6];

// Time options at 30-min increments
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 23; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 23) TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}

function TimePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <View style={tp.picker}>
          <Text style={tp.pickerTitle}>Select time</Text>
          <ScrollView style={tp.list} showsVerticalScrollIndicator={false}>
            {TIME_OPTIONS.map((t) => (
              <Pressable
                key={t}
                onPress={() => { onSelect(t); onClose(); }}
                style={[tp.option, value === t && tp.optionActive]}
              >
                <Text style={[tp.optionText, value === t && tp.optionActiveText]}>
                  {formatTimeDisplay(t)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,18,32,0.4)', justifyContent: 'center', alignItems: 'center' },
  picker: { backgroundColor: colors.bgElevated, borderRadius: radius.lg, width: 240, maxHeight: 360, overflow: 'hidden' },
  pickerTitle: { ...typography.labelLg, color: colors.textPrimary, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderDefault },
  list: { maxHeight: 300 },
  option: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  optionActive: { backgroundColor: colors.surfaceBrand },
  optionText: { ...typography.bodyMd, color: colors.textPrimary },
  optionActiveText: { color: colors.textInverse },
});

type PickerTarget = { day: DayOfWeek; field: 'openTime' | 'closeTime' } | null;

export function WeeklyRulesTab() {
  const {
    availability,
    draft,
    patchDraftWeeklyRule,
    patchDraftSlotLength,
    patchDraftCapacity,
    patchDraftServiceModeRules,
  } = useVendorAvailabilityStore();

  const active = draft ?? availability;
  const { weeklyRules, slotLengthMinutes, capacityPerSlot, serviceModeRules } = active;

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  // copy-to-days state
  const [copySourceDay, setCopySourceDay] = useState<DayOfWeek | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<DayOfWeek[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const weeklySlots = countWeeklySlots(active);

  const openPicker = (day: DayOfWeek, field: 'openTime' | 'closeTime') => {
    setPickerTarget({ day, field });
  };

  const applyCopyToDays = () => {
    if (copySourceDay === null) return;
    const sourceRule = weeklyRules[copySourceDay];
    copyTargetDays.forEach((d) => {
      if (d !== copySourceDay) {
        patchDraftWeeklyRule(d, {
          openTime: sourceRule.openTime,
          closeTime: sourceRule.closeTime,
        });
      }
    });
    setCopyTargetDays([]);
    setShowCopyModal(false);
  };

  const toggleCopyTarget = (d: DayOfWeek) => {
    setCopyTargetDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  return (
    <>
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{weeklySlots}</Text>
          <Text style={styles.summaryLabel}>Weekly slots</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{slotLengthMinutes}m</Text>
          <Text style={styles.summaryLabel}>Slot length</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{capacityPerSlot}</Text>
          <Text style={styles.summaryLabel}>Per slot</Text>
        </View>
      </View>

      {/* Day rules */}
      {ORDERED_DAYS.map((day) => {
        const rule = weeklyRules[day];
        const timeError = rule.bookable
          ? validateTimeRange(rule.openTime, rule.closeTime)
          : null;

        return (
          <AppCard key={day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{DAY_FULL_LABELS[day]}</Text>
              <View style={styles.dayHeaderRight}>
                {rule.bookable ? (
                  <Pressable
                    onPress={() => { setCopySourceDay(day); setShowCopyModal(true); }}
                    style={styles.copyBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.copyBtnText}>Copy to days</Text>
                  </Pressable>
                ) : null}
                <Switch
                  value={rule.bookable}
                  onValueChange={() => patchDraftWeeklyRule(day, { bookable: !rule.bookable })}
                  trackColor={{ true: colors.surfaceBrand, false: colors.borderStrong }}
                  thumbColor={colors.bgElevated}
                  accessibilityLabel={`Toggle ${DAY_FULL_LABELS[day]}`}
                />
              </View>
            </View>

            {rule.bookable ? (
              <>
                <View style={styles.timePair}>
                  <Pressable
                    onPress={() => openPicker(day, 'openTime')}
                    style={styles.timeField}
                    accessibilityLabel={`${DAY_FULL_LABELS[day]} open time`}
                  >
                    <Text style={styles.timeFieldLabel}>OPEN</Text>
                    <Text style={styles.timeFieldValue}>{formatTimeDisplay(rule.openTime)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openPicker(day, 'closeTime')}
                    style={styles.timeField}
                    accessibilityLabel={`${DAY_FULL_LABELS[day]} close time`}
                  >
                    <Text style={styles.timeFieldLabel}>CLOSE</Text>
                    <Text style={styles.timeFieldValue}>{formatTimeDisplay(rule.closeTime)}</Text>
                  </Pressable>
                </View>
                {timeError ? (
                  <Text style={styles.timeError}>{timeError}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.dayClosedNote}>Customers cannot book on this day.</Text>
            )}
          </AppCard>
        );
      })}

      {/* Slot length */}
      <AppCard style={styles.card}>
        <Text style={styles.cardSectionLabel}>Slot length</Text>
        <View style={styles.chipRow}>
          {SLOT_LENGTH_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => patchDraftSlotLength(opt)}
              style={[styles.optChip, slotLengthMinutes === opt && styles.optChipActive]}
            >
              <Text style={[styles.optChipText, slotLengthMinutes === opt && styles.optChipActiveText]}>
                {opt}m
              </Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      {/* Capacity */}
      <AppCard style={styles.card}>
        <Text style={styles.cardSectionLabel}>Capacity per slot</Text>
        <View style={styles.chipRow}>
          {CAPACITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => patchDraftCapacity(opt)}
              style={[styles.optChip, capacityPerSlot === opt && styles.optChipActive]}
            >
              <Text style={[styles.optChipText, capacityPerSlot === opt && styles.optChipActiveText]}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      {/* Service-mode rules */}
      <AppCard style={styles.card}>
        <Text style={styles.cardSectionLabel}>Booking modes</Text>
        <ServiceModeRow
          label="Shop visits"
          description="Uses your fixed location and bay capacity"
          value={serviceModeRules.shopVisitsEnabled}
          onToggle={() => patchDraftServiceModeRules({ shopVisitsEnabled: !serviceModeRules.shopVisitsEnabled })}
        />
        <ServiceModeRow
          label="Mobile service"
          description="Requires travel buffer between jobs"
          value={serviceModeRules.mobileServiceEnabled}
          onToggle={() => patchDraftServiceModeRules({ mobileServiceEnabled: !serviceModeRules.mobileServiceEnabled })}
        />
        <ServiceModeRow
          label="Same-day requests"
          description={`Min ${serviceModeRules.sameDayLeadHours}h lead time`}
          value={serviceModeRules.sameDayBookingEnabled}
          onToggle={() => patchDraftServiceModeRules({ sameDayBookingEnabled: !serviceModeRules.sameDayBookingEnabled })}
        />
      </AppCard>

      {/* Time picker modal */}
      {pickerTarget ? (
        <TimePickerModal
          visible={Boolean(pickerTarget)}
          value={weeklyRules[pickerTarget.day][pickerTarget.field]}
          onSelect={(t) => patchDraftWeeklyRule(pickerTarget.day, { [pickerTarget.field]: t })}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}

      {/* Copy-to-days modal */}
      <Modal visible={showCopyModal} transparent animationType="fade" onRequestClose={() => setShowCopyModal(false)}>
        <Pressable style={copyStyles.overlay} onPress={() => setShowCopyModal(false)}>
          <View style={copyStyles.sheet}>
            <Text style={copyStyles.title}>
              Copy {copySourceDay !== null ? DAY_FULL_LABELS[copySourceDay] : ''} hours to
            </Text>
            <Text style={copyStyles.sub}>Select which days to apply the same open/close time</Text>
            <View style={copyStyles.dayGrid}>
              {ORDERED_DAYS.filter((d) => d !== copySourceDay).map((d) => {
                const selected = copyTargetDays.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleCopyTarget(d)}
                    style={[copyStyles.dayChip, selected && copyStyles.dayChipActive]}
                  >
                    <Text style={[copyStyles.dayChipText, selected && copyStyles.dayChipActiveText]}>
                      {DAY_LABELS[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={copyStyles.actions}>
              <AppButton label="Cancel" variant="secondary" style={copyStyles.actionBtn} onPress={() => setShowCopyModal(false)} />
              <AppButton
                label={`Copy to ${copyTargetDays.length} day${copyTargetDays.length !== 1 ? 's' : ''}`}
                variant="accent"
                style={copyStyles.actionBtn}
                onPress={applyCopyToDays}
                disabled={copyTargetDays.length === 0}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ServiceModeRow({
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
    <View style={styles.modeRow}>
      <View style={styles.modeCopy}>
        <Text style={styles.modeLabel}>{label}</Text>
        <Text style={styles.modeDesc}>{description}</Text>
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

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: colors.bgStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 22,
    color: colors.textInverse,
  },
  summaryLabel: {
    ...typography.caption,
    color: '#CBD5E1',
  },
  dayCard: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dayName: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnText: {
    ...typography.caption,
    color: colors.surfaceBrand,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  timePair: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 56,
    justifyContent: 'center',
  },
  timeFieldLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeFieldValue: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  timeError: {
    ...typography.caption,
    color: colors.danger,
  },
  dayClosedNote: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  card: { gap: spacing.md },
  cardSectionLabel: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optChip: {
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
  optChipActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  optChipText: { ...typography.labelMd, color: colors.textSecondary },
  optChipActiveText: { color: colors.textInverse },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  modeCopy: { flex: 1, gap: spacing.xs },
  modeLabel: { ...typography.labelLg, color: colors.textPrimary },
  modeDesc: { ...typography.caption, color: colors.textSecondary },
});

const copyStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,18,32,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: spacing.xl, width: '100%', gap: spacing.md },
  title: { ...typography.titleSm, color: colors.textPrimary },
  sub: { ...typography.bodyMd, color: colors.textSecondary },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: colors.bgStrong, borderColor: colors.bgStrong },
  dayChipText: { ...typography.labelMd, color: colors.textSecondary },
  dayChipActiveText: { color: colors.textInverse },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },
});
