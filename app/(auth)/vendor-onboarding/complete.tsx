import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '@/store/useAuthStore';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

const NEXT_STEPS: { label: string; description: string; route: string }[] = [
  {
    label: 'Review your live services',
    description: 'Edit catalog, toggle visibility, and refine pricing.',
    route: '/(vendor)/services',
  },
  {
    label: 'Confirm your location and radius',
    description: 'Update address, service area, and mobile coverage.',
    route: '/(vendor)/location',
  },
  {
    label: 'Open your operational dashboard',
    description: 'See bookings, earnings overview, and quick actions.',
    route: '/(vendor)',
  },
  {
    label: 'Visit your vendor profile',
    description: 'Manage account details and sign-out options.',
    route: '/(vendor)/profile',
  },
];

export default function VendorOnboardingComplete() {
  const router = useRouter();
  const { draft, reset } = useVendorOnboardingStore();
  const profile = useAuthStore((s) => s.profile);

  const snapshotRef = useRef({
    businessName: draft?.profile?.businessName,
    serviceCount: (draft?.services ?? []).filter((s) => s.active ?? true).length,
    totalServices: (draft?.services ?? []).length,
    completed: draft?.completed ?? false,
  });

  const snapshot = snapshotRef.current;

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCompleted =
    snapshot.completed ||
    (profile?.role === 'vendor' && Boolean(profile.businessType));

  if (!isCompleted) {
    return <Redirect href="/(auth)/vendor-onboarding" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.crest}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.title}>{"You're set up"}</Text>
          {snapshot.businessName ? (
            <Text style={styles.subtitle}>{snapshot.businessName} is live on AutoServe.</Text>
          ) : (
            <Text style={styles.subtitle}>Your vendor account is ready.</Text>
          )}
        </View>

        <AppCard style={styles.card}>
          <Text style={typography.titleSm}>Setup complete</Text>
          <CompletedRow label="Business profile saved" />
          <CompletedRow label="Location and service area set" />
          <CompletedRow
            label={
              snapshot.totalServices === 1
                ? '1 service published'
                : `${snapshot.serviceCount} of ${snapshot.totalServices} services enabled`
            }
          />
        </AppCard>

        <AppCard style={styles.nextStepsCard}>
          <View style={styles.nextStepsHeader}>
            <Text style={typography.titleSm}>Recommended next steps</Text>
            <Text style={styles.recommendedTag}>Optional</Text>
          </View>
          {NEXT_STEPS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.replace(item.route as Parameters<typeof router.replace>[0])}
              style={({ pressed }) => [styles.nextStepRow, pressed && styles.nextStepRowPressed]}
            >
              <View style={styles.nextStepText}>
                <Text style={styles.nextStepLabel}>{item.label}</Text>
                <Text style={styles.nextStepDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </AppCard>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label="Go to dashboard"
          onPress={() => router.replace('/(vendor)')}
        />
        <AppButton
          label="Review setup again"
          variant="ghost"
          onPress={() => router.replace('/(auth)/vendor-onboarding/review')}
        />
      </View>
    </SafeAreaView>
  );
}

function CompletedRow({ label }: { label: string }) {
  return (
    <View style={completedStyles.row}>
      <View style={completedStyles.dot} />
      <Text style={completedStyles.label}>{label}</Text>
    </View>
  );
}

const completedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceBrand,
  },
  label: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    flex: 1,
  },
});

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
  checkMark: {
    fontSize: 54,
    color: colors.surfaceBrand,
    textAlign: 'center',
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
  nextStepsCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtleGreen,
    borderColor: colors.surfaceSubtleGreen,
  },
  nextStepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendedTag: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  nextStepRowPressed: {
    opacity: 0.85,
  },
  nextStepText: {
    flex: 1,
    gap: spacing.xs,
  },
  nextStepLabel: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  nextStepDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chevron: {
    ...typography.titleSm,
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
