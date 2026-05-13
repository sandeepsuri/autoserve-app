import { StyleSheet, Text } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, typography } from '@/constants/theme';

export default function ServicesStep() {
  return (
    <OnboardingStepShell
      stepId="services"
      title="Initial services"
      subtitle="Add the services you offer. You can manage these later from your dashboard."
      canContinue
    >
      <AppCard>
        <Text style={styles.placeholder}>Service catalog editor goes here.</Text>
        <Text style={styles.note}>This step is implemented by the services ticket.</Text>
      </AppCard>
    </OnboardingStepShell>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  note: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
