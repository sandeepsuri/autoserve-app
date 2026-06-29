import { ReactNode, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Href, useRouter } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { colors, spacing, typography } from '@/constants/theme';
import { isVendorApplicationLocked } from '@/lib/vendor-onboarding';
import { getNextStep, getPrevStep, VendorOnboardingStepId } from '@/lib/vendor-onboarding-steps';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

interface Props {
  stepId: VendorOnboardingStepId;
  title: string;
  subtitle?: string;
  canContinue: boolean;
  onContinue?: () => void | Promise<void>;
  continueLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children: ReactNode;
}

export function OnboardingStepShell({
  stepId,
  title,
  subtitle,
  canContinue,
  onContinue,
  continueLabel = 'Continue',
  secondaryLabel = 'Save & exit',
  onSecondary,
  children,
}: Props) {
  const router = useRouter();
  const markComplete = useVendorOnboardingStore((s) => s.markComplete);
  const draft = useVendorOnboardingStore((s) => s.draft);

  const prevStep = getPrevStep(stepId);
  const nextStep = getNextStep(stepId);
  const backTarget: Href = prevStep?.route ?? '/(auth)/role';

  useEffect(() => {
    if (stepId !== 'review' && (draft?.completed || isVendorApplicationLocked(draft?.applicationStatus))) {
      router.replace('/(auth)/vendor-onboarding/review');
    }
  }, [draft?.applicationStatus, draft?.completed, router, stepId]);

  const handleBack = () => router.replace(backTarget);

  const handleContinue = async () => {
    if (!canContinue) return;
    markComplete(stepId);
    if (onContinue) {
      try {
        await onContinue();
      } catch (err) {
        console.warn(`[onboarding] step ${stepId} save failed; proceeding with local draft`, err);
      }
    }
    if (nextStep) {
      router.replace(nextStep.route);
    }
  };

  const handleSaveExit = () => {
    if (onSecondary) {
      onSecondary();
      return;
    }
    router.replace('/(auth)/role');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader title={title} subtitle={subtitle} onBack={handleBack} />
        <OnboardingProgress stepId={stepId} />
        {children}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={continueLabel}
          disabled={!canContinue}
          onPress={handleContinue}
        />
        <AppButton
          label={secondaryLabel}
          variant="ghost"
          onPress={handleSaveExit}
        />
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
  footer: {
    padding: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
});
