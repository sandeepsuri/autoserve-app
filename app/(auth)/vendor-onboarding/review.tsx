import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, spacing, typography } from '@/constants/theme';
import { submitVendorOnboarding } from '@/lib/vendor-onboarding';
import { isDraftReadyFor } from '@/lib/vendor-onboarding-steps';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

export default function ReviewStep() {
  const router = useRouter();
  const { draft, reset } = useVendorOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isDraftReadyFor('review', draft) && !submitting;

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
        {draft?.services?.length ? (
          draft.services.map((s, i) => (
            <Text key={i} style={styles.rowValue}>
              {s.title ?? 'Untitled'}
            </Text>
          ))
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
});
