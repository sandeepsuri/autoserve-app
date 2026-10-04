import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '@/store/useAuthStore';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { colors, spacing, typography } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

export default function VendorOnboardingComplete() {
  const router = useRouter();
  const { draft, reset } = useVendorOnboardingStore();
  const vendorCapability = useAuthStore((s) => s.vendorCapability);

  const snapshotRef = useRef({
    businessName: draft?.profile?.businessName,
    serviceCount: (draft?.services ?? []).filter((s) => s.active ?? true).length,
    totalServices: (draft?.services ?? []).length,
    completed: draft?.completed ?? false,
    applicationStatus: draft?.applicationStatus,
  });

  const snapshot = snapshotRef.current;

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSubmitted =
    snapshot.completed ||
    snapshot.applicationStatus === 'submitted' ||
    snapshot.applicationStatus === 'under_review' ||
    snapshot.applicationStatus === 'needs_more_info' ||
    Boolean(vendorCapability?.hasActiveVendor);

  if (!isSubmitted) {
    return <Redirect href="/(auth)/vendor-onboarding" />;
  }

  const isApprovedVendor = Boolean(vendorCapability?.hasActiveVendor);
  const returnToLogin = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.crest}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.title}>{isApprovedVendor ? "You're set up" : 'Application submitted'}</Text>
          {snapshot.businessName ? (
            <Text style={styles.subtitle}>
              {isApprovedVendor
                ? `${snapshot.businessName} is live on AutoServe.`
                : `${snapshot.businessName} is pending review. We'll notify you once an admin approves your application.`}
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              {isApprovedVendor
                ? 'Your vendor account is ready.'
                : 'Your vendor application is pending review.'}
            </Text>
          )}
        </View>

        <AppCard style={styles.card}>
          <Text style={typography.titleSm}>{isApprovedVendor ? 'Setup complete' : 'What happens next'}</Text>
          <CompletedRow label="Business profile saved" />
          <CompletedRow label="Location and service area set" />
          <CompletedRow
            label={
              snapshot.totalServices === 1
                ? '1 service included in your application'
                : `${snapshot.serviceCount} of ${snapshot.totalServices} services included`
            }
          />
          {!isApprovedVendor ? (
            <CompletedRow label="AutoServe admin review required before you go live" />
          ) : null}
        </AppCard>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={isApprovedVendor ? 'Go to dashboard' : 'Return to login'}
          onPress={isApprovedVendor ? () => router.replace('/(vendor)') : returnToLogin}
        />
        {!isApprovedVendor ? (
          <AppButton
            label="Review application"
            variant="ghost"
            onPress={() => router.replace('/(auth)/vendor-onboarding/review')}
          />
        ) : null}
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
  footer: {
    padding: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
});
