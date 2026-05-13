import { StyleSheet, Text } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, typography } from '@/constants/theme';

export default function BusinessInfoStep() {
  return (
    <OnboardingStepShell
      stepId="business-info"
      title="Business info"
      subtitle="Tell clients about your business."
      canContinue
    >
      <AppCard>
        <Text style={styles.placeholder}>Business name, description, and contact details go here.</Text>
        <Text style={styles.note}>This step is implemented by the business-info ticket.</Text>
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
