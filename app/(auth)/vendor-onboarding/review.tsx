import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import {
  AccountSummaryCard,
  LocationSummaryCard,
  row,
  ServicesSummaryCard,
} from '@/components/onboarding/ApplicationSummary';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  isVendorApplicationLocked,
  loadVendorOnboardingDraft,
  submitVendorOnboarding,
} from '@/lib/vendor-onboarding';
import { getStep, isDraftReadyFor } from '@/lib/vendor-onboarding-steps';
import { useAuthStore } from '@/store/useAuthStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import {
  countWeeklySlots,
  DAY_LABELS,
  DayOfWeek,
  formatTimeDisplay,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';

const APPLICATION_STATUS_COPY = {
  submitted: {
    title: 'Application submitted',
    body: 'Your application is pending admin review. You can review the details here, but edits are locked unless an admin requests more information.',
  },
  under_review: {
    title: 'Application under review',
    body: 'An AutoServe admin is reviewing your application. Edits are locked unless more information is requested.',
  },
  approved: {
    title: 'Application approved',
    body: 'Your vendor account has been approved.',
  },
  rejected: {
    title: 'Application rejected',
    body: 'This application is no longer editable. Contact AutoServe support if you need help.',
  },
  suspended: {
    title: 'Application suspended',
    body: 'This application is no longer editable. Contact AutoServe support if you need help.',
  },
} as const;

export default function ReviewStep() {
  const router = useRouter();
  const { draft, setDraft, reset } = useVendorOnboardingStore();
  const { availability } = useVendorAvailabilityStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = useAuthStore.getState().session;
    const isStale = Boolean(draft && session && draft.ownerId !== session.userId);
    if (isStale) reset();

    loadVendorOnboardingDraft()
      .then(setDraft)
      .catch(() => {
        if (draft && !isStale) return;
        const { session, profile } = useAuthStore.getState();
        if (!session) return;
        setDraft({
          ownerId: session.userId,
          businessType: profile?.businessType,
          profile: {
            contactName: profile?.fullName,
            contactEmail: profile?.email,
            contactPhone: profile?.phone,
          },
          location: {},
          services: [],
          completed: false,
        });
      })
      .finally(() => setReady(true));
  }, []);

  const isLocked = isVendorApplicationLocked(draft?.applicationStatus);
  const canSubmit = isDraftReadyFor('review', draft) && !submitting && !isLocked;
  const statusCopy = draft?.applicationStatus && draft.applicationStatus in APPLICATION_STATUS_COPY
    ? APPLICATION_STATUS_COPY[draft.applicationStatus as keyof typeof APPLICATION_STATUS_COPY]
    : null;

  const handleSubmit = async () => {
    if (isLocked) {
      router.replace('/(auth)/vendor-onboarding/complete');
      return;
    }

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
    if (isLocked) return;
    router.push(getStep(stepId).route);
  };

  const ORDERED_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];
  const openDays = ORDERED_DAYS.filter((d) => availability.weeklyRules[d].bookable);
  const weeklySlots = countWeeklySlots(availability);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase }}>
        <ActivityIndicator color={colors.surfaceBrand} />
      </View>
    );
  }

  return (
    <OnboardingStepShell
      stepId="review"
      title={isLocked ? 'Review application' : 'Review your setup'}
      subtitle={isLocked ? 'Your submitted details are shown below.' : 'Check your details before finishing.'}
      canContinue={isLocked || canSubmit}
      onContinue={handleSubmit}
      continueLabel={isLocked ? 'Back to status' : submitting ? 'Finishing…' : 'Finish setup'}
      secondaryLabel={isLocked ? 'Return to client home' : 'Save & exit'}
      onSecondary={isLocked ? () => router.replace('/(client)') : undefined}
    >
      {statusCopy ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerTitle}>{statusCopy.title}</Text>
          <Text style={styles.statusBannerText}>{statusCopy.body}</Text>
        </View>
      ) : null}

      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <AccountSummaryCard
        draft={draft}
        header={<SectionEditRow title="Account" editable={!isLocked} onEdit={() => editSection('business-info')} />}
      />

      <LocationSummaryCard
        draft={draft}
        header={<SectionEditRow title="Location" editable={!isLocked} onEdit={() => editSection('location')} />}
      />

      <AppCard style={styles.card}>
        <SectionEditRow title="Availability" editable={!isLocked} onEdit={() => editSection('availability')} />
        {openDays.length > 0 ? (
          <>
            {row('Open days', openDays.map((d) => DAY_LABELS[d]).join(', '))}
            {row('Weekly slots', String(weeklySlots))}
            {row('Slot length', `${availability.slotLengthMinutes} min`)}
            {row('Capacity / slot', String(availability.capacityPerSlot))}
            {openDays.map((d) => {
              const rule = availability.weeklyRules[d];
              return row(DAY_LABELS[d], `${formatTimeDisplay(rule.openTime)} – ${formatTimeDisplay(rule.closeTime)}`);
            })}
          </>
        ) : (
          <Text style={styles.rowLabel}>No open days configured. Edit availability before finishing.</Text>
        )}
      </AppCard>

      <ServicesSummaryCard
        draft={draft}
        header={<SectionEditRow title="Services" editable={!isLocked} onEdit={() => editSection('services')} />}
      />
    </OnboardingStepShell>
  );
}

function SectionEditRow({ title, editable = true, onEdit }: { title: string; editable?: boolean; onEdit: () => void }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={typography.titleSm}>{title}</Text>
      {editable ? (
        <Pressable onPress={onEdit} style={sectionStyles.editButton} hitSlop={8}>
          <Text style={sectionStyles.editLabel}>Edit</Text>
        </Pressable>
      ) : null}
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
  statusBanner: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  statusBannerTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  statusBannerText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
