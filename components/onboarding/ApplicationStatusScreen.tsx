import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { ApplicationSummary } from '@/components/onboarding/ApplicationSummary';
import { colors, spacing, typography } from '@/constants/theme';
import type { VendorApplicationStatus, VendorOnboardingDraft } from '@/types/domain';

export type ApplicationStatusScreenStatus = Extract<
  VendorApplicationStatus,
  'rejected' | 'needs_more_info' | 'suspended' | 'submitted' | 'under_review'
>;

const STATUS_COPY: Record<ApplicationStatusScreenStatus, { title: string; body: string; nextSteps: string }> = {
  submitted: {
    title: 'Your application is under review',
    body: 'Your vendor application has been submitted and is being reviewed by our team.',
    nextSteps: "We'll notify you once a decision is made. No action is needed from you right now.",
  },
  under_review: {
    title: 'Your application is under review',
    body: 'Your vendor application is being reviewed by our team.',
    nextSteps: "We'll notify you once a decision is made. No action is needed from you right now.",
  },
  rejected: {
    title: 'Your application was not approved',
    body: 'Your vendor application was not approved at this time.',
    nextSteps:
      'If you believe this was a mistake or want more detail, contact AutoServe support. You can keep using AutoServe as a client in the meantime.',
  },
  needs_more_info: {
    title: 'We need more information',
    body: 'Our team needs additional details to continue reviewing your application.',
    nextSteps:
      "Our team will contact you via email or phone with what's needed. No action is required from you right now.",
  },
  suspended: {
    title: 'Your vendor access has been suspended',
    body: 'Your vendor account has been suspended and is not currently visible to customers.',
    nextSteps: 'Contact AutoServe support for details on next steps and how to restore access.',
  },
};

const PENDING_REVIEW_STATUSES: ApplicationStatusScreenStatus[] = ['submitted', 'under_review'];

interface Props {
  status: ApplicationStatusScreenStatus;
  /**
   * The applicant's submitted application, used to render a read-only
   * summary below "What happens next" for submitted/under_review statuses.
   * Ignored for rejected/needs_more_info/suspended.
   */
  draft?: VendorOnboardingDraft | null;
}

export function ApplicationStatusScreen({ status, draft }: Props) {
  const router = useRouter();
  const copy = STATUS_COPY[status];
  const showSummary = PENDING_REVIEW_STATUSES.includes(status);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.crest}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.body}</Text>
        </View>

        <AppCard style={styles.card}>
          <Text style={typography.titleSm}>What happens next</Text>
          <Text style={styles.bodyText}>{copy.nextSteps}</Text>
        </AppCard>

        {showSummary ? <ApplicationSummary draft={draft} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton label="Return to client home" onPress={() => router.replace('/(client)')} />
      </View>
    </SafeAreaView>
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
  crest: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  title: {
    ...typography.titleLg,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    gap: spacing.md,
  },
  bodyText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
});
