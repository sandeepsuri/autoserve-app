import { StyleSheet, Text } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, typography } from '@/constants/theme';

export default function LocationStep() {
  return (
    <OnboardingStepShell
      stepId="location"
      title="Location & service area"
      subtitle="Set your address and mobile service radius."
      canContinue
    >
      <AppCard>
        <Text style={styles.placeholder}>Address, location mode, and service radius go here.</Text>
        <Text style={styles.note}>This step is implemented by the location ticket.</Text>
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
