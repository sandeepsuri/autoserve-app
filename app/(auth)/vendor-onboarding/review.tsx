import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { submitVendorOnboarding } from '@/lib/vendor-onboarding';
import { isDraftReadyFor } from '@/lib/vendor-onboarding-steps';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
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
  const { draft, reset } = useVendorOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isDraftReadyFor('review', draft) && !submitting;
  const services = draft?.services ?? [];
  const activeServices = services.filter((service) => service.active ?? true);
  const hiddenServices = services.filter((service) => !(service.active ?? true));
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
    try {
      await submitVendorOnboarding();
      reset();
      router.replace('/(vendor)');
    } catch (err) {
      console.warn('[onboarding] submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

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
      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Account</Text>
        {row('Type', draft?.businessType === 'shop' ? 'Business shop' : draft?.businessType === 'solo' ? 'Solo vendor' : undefined)}
        {row('Business name', draft?.profile?.businessName)}
        {row('Contact', draft?.profile?.contactName)}
        {row('Email', draft?.profile?.contactEmail)}
        {row('Phone', draft?.profile?.contactPhone)}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Location</Text>
        {row('Address', draft?.location?.address)}
        {row('Mode', draft?.location?.mode)}
        {draft?.location?.serviceRadiusMiles
          ? row('Service radius', `${draft.location.serviceRadiusMiles} miles`)
          : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Services</Text>
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
                    {service.category ? CATEGORY_LABELS[service.category] : 'Uncategorized'} · {service.durationMinutes ?? 0} min · ${service.price ?? 0}
                  </Text>
                  {service.description ? <Text style={styles.serviceDescription}>{service.description}</Text> : null}
                </View>
                <View style={[styles.statusPill, (service.active ?? true) ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, (service.active ?? true) ? styles.statusTextActive : styles.statusTextInactive]}>
                    {service.active ?? true ? 'Enabled' : 'Hidden'}
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

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
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
