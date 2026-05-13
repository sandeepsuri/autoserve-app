import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, spacing, typography } from '@/constants/theme';
import { saveVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import { BusinessType } from '@/types/domain';

export default function AccountTypeStep() {
  const { draft, patchDraft } = useVendorOnboardingStore();
  const [saving, setSaving] = useState(false);

  const selection: BusinessType | undefined = draft?.businessType;

  const select = (type: BusinessType) => {
    patchDraft({ businessType: type });
  };

  const handleContinue = async () => {
    if (!selection) return;
    setSaving(true);
    try {
      await saveVendorOnboardingDraft({ businessType: selection });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepShell
      stepId="account-type"
      title="What kind of vendor account?"
      subtitle="Your account type shapes how AutoServe presents your business to clients."
      canContinue={Boolean(selection) && !saving}
      onContinue={handleContinue}
    >
      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Business shop</Text>
        <Text style={styles.body}>Best for fixed locations with a team and a consistent storefront.</Text>
        <AppButton
          label="Select Business"
          variant={selection === 'shop' ? 'primary' : 'secondary'}
          onPress={() => select('shop')}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Solo vendor</Text>
        <Text style={styles.body}>Best for independent mobile mechanics traveling directly to customers.</Text>
        <AppButton
          label="Select Solo Vendor"
          variant={selection === 'solo' ? 'primary' : 'secondary'}
          onPress={() => select('solo')}
        />
      </AppCard>
    </OnboardingStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
