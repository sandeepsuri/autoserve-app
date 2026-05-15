import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { getStep, VENDOR_ONBOARDING_STEPS, VendorOnboardingStepId } from '@/lib/vendor-onboarding-steps';

interface Props {
  stepId: VendorOnboardingStepId;
}

export function OnboardingProgress({ stepId }: Props) {
  const current = getStep(stepId);
  const total = VENDOR_ONBOARDING_STEPS.length;

  return (
    <View style={styles.container}>
      <View style={styles.segments}>
        {VENDOR_ONBOARDING_STEPS.map((s) => (
          <View
            key={s.id}
            style={[styles.segment, s.index <= current.index ? styles.segmentFilled : styles.segmentEmpty]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        Step {current.index + 1} of {total} — {current.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  segmentFilled: {
    backgroundColor: colors.surfaceBrand,
  },
  segmentEmpty: {
    backgroundColor: colors.borderDefault,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
