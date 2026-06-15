import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { submitVendorOnboarding } from '@/lib/vendor-onboarding';
import {
  BUSINESS_TYPE_LABELS,
  getStep,
  isDraftReadyFor,
  LOCATION_MODE_LABELS,
} from '@/lib/vendor-onboarding-steps';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import {
  countWeeklySlots,
  DAY_LABELS,
  DayOfWeek,
  formatTimeDisplay,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';
import { ServiceCategory } from '@/types/domain';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  diagnostics: 'Diagnostics',
  oil: 'Oil',
  brakes: 'Brakes',
  tire: 'Tire',
  repairs: 'Repairs',
  bodywork: 'Bodywork',
  detailing: 'Detailing',
  tint: 'Tint',
};

export default function ReviewStep() {
  const router = useRouter();
  const { draft } = useVendorOnboardingStore();
  const { availability } = useVendorAvailabilityStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = isDraftReadyFor('review', draft) && !submitting;
  const services = useMemo(() => draft?.services ?? [], [draft?.services]);
  const activeServices = useMemo(() => services.filter((s) => s.active ?? true), [services]);
  const hiddenServices = useMemo(() => services.filter((s) => !(s.active ?? true)), [services]);
  const categorySummary = useMemo(() => {
    return Array.from(
      new Set(
        services
          .map((service) => service.category)
          .filter((category): category is ServiceCategory => Boolean(category)),
      ),
    ).map((category) => CATEGORY_LABELS[category]);
  }, [services]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitVendorOnboarding();
      router.replace('/(auth)/vendor-onboarding/complete');
    } catch (err) {
      console.warn('[onboarding] submit failed', err);
      setSubmitError('Something went wrong. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const editSection = (stepId: 'account-type' | 'business-info' | 'location' | 'services' | 'availability') => {
    router.push(getStep(stepId).route);
  };

  const ORDERED_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
  const openDays = ORDERED_DAYS.filter((d) => availability.weeklyRules[d].bookable);
  const weeklySlots = countWeeklySlots(availability);

  const row = (label: string, value: string | undefined) =>
    value ? (
      <View style={styles.row} key={label}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    ) : null;

  return (
    <OnboardingStepShell
      stepId="review"
      title="Review your setup"
      subtitle="Check your details before finishing."
      canContinue={canSubmit}
      onContinue={handleSubmit}
      continueLabel={submitting ? 'Finishing…' : 'Finish setup'}
    >
      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <AppCard style={styles.card}>
        <SectionEditRow title="Account" onEdit={() => editSection('business-info')} />
        {row('Type', draft?.businessType ? BUSINESS_TYPE_LABELS[draft.businessType] : undefined)}
        {row('Business name', draft?.profile?.businessName)}
        {row('Description', draft?.profile?.description)}
        {row('Contact', draft?.profile?.contactName)}
        {row('Email', draft?.profile?.contactEmail)}
        {row('Phone', draft?.profile?.contactPhone)}
      </AppCard>

      <AppCard style={styles.card}>
        <SectionEditRow title="Location" onEdit={() => editSection('location')} />
        {row('Mode', draft?.location?.mode ? LOCATION_MODE_LABELS[draft.location.mode] : undefined)}
        {row('Address', draft?.location?.address)}
        {draft?.location?.serviceRadiusMiles
          ? row('Service radius', `${draft.location.serviceRadiusMiles} mi`)
          : null}
      </AppCard>

      <AppCard style={styles.card}>
        <SectionEditRow title="Availability" onEdit={() => editSection('availability')} />
        {openDays.length > 0 ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Open days</Text>
              <Text style={styles.rowValue}>{openDays.map((d) => DAY_LABELS[d]).join(', ')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Weekly slots</Text>
              <Text style={styles.rowValue}>{weeklySlots}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Slot length</Text>
              <Text style={styles.rowValue}>{availability.slotLengthMinutes} min</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Capacity / slot</Text>
              <Text style={styles.rowValue}>{availability.capacityPerSlot}</Text>
            </View>
            {openDays.map((d) => {
              const rule = availability.weeklyRules[d];
              return (
                <View style={styles.row} key={d}>
                  <Text style={styles.rowLabel}>{DAY_LABELS[d]}</Text>
                  <Text style={styles.rowValue}>
                    {formatTimeDisplay(rule.openTime)} – {formatTimeDisplay(rule.closeTime)}
                  </Text>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.rowLabel}>No open days configured. Edit availability before finishing.</Text>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <SectionEditRow title="Services" onEdit={() => editSection('services')} />
        {services.length ? (
          <>
            <View style={styles.serviceSummaryRow}>
              <SummaryBadge label={`${activeServices.length} enabled`} tone="active" />
              <SummaryBadge label={`${hiddenServices.length} hidden`} tone="muted" />
              <SummaryBadge label={`${categorySummary.length} categories`} tone="neutral" />
            </View>
            {categorySummary.length ? (
              <Text style={styles.categorySummary}>{categorySummary.join(' · ')}</Text>
            ) : null}
            {services.map((service, index) => (
              <View key={`${service.id ?? 'service'}-${index}`} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>{service.title ?? 'Untitled service'}</Text>
                  <Text style={styles.serviceMeta}>
                    {service.category ? CATEGORY_LABELS[service.category] : 'Uncategorized'} ·{' '}
                    {service.durationMinutes ?? 0} min · ${service.price ?? 0}
                  </Text>
                  {service.description ? (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    (service.active ?? true) ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      (service.active ?? true) ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {(service.active ?? true) ? 'Enabled' : 'Hidden'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.rowLabel}>No services added yet.</Text>
        )}
      </AppCard>
    </OnboardingStepShell>
  );
}

function SectionEditRow({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={typography.titleSm}>{title}</Text>
      <Pressable onPress={onEdit} style={sectionStyles.editButton} hitSlop={8}>
        <Text style={sectionStyles.editLabel}>Edit</Text>
      </Pressable>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editLabel: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.pending,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 1,
  },
  serviceSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categorySummary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
  },
  serviceInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  serviceMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serviceDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusActive: {
    backgroundColor: colors.surfaceSubtleGreen,
  },
  statusInactive: {
    backgroundColor: colors.surfaceSubtleOrange,
  },
  statusText: {
    ...typography.caption,
  },
  statusTextActive: {
    color: colors.completed,
  },
  statusTextInactive: {
    color: colors.pending,
  },
});

function SummaryBadge({ label, tone }: { label: string; tone: 'active' | 'muted' | 'neutral' }) {
  return (
    <View
      style={[
        summaryStyles.badge,
        tone === 'active' && summaryStyles.active,
        tone === 'muted' && summaryStyles.muted,
        tone === 'neutral' && summaryStyles.neutral,
      ]}
    >
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  active: {
    backgroundColor: colors.surfaceSubtleGreen,
  },
  muted: {
    backgroundColor: colors.surfaceSubtleOrange,
  },
  neutral: {
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
