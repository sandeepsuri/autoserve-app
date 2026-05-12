import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { setRole } from '@/lib/auth';

export default function VendorSetupScreen() {
  const [selection, setSelection] = useState<'shop' | 'solo'>('shop');
  const router = useRouter();

  return (
    <Screen contentStyle={styles.container}>
      <AppHeader title="What kind of vendor account are you creating?" fallbackHref="/(auth)/role" />

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Business shop</Text>
        <Text style={styles.body}>Best for fixed locations with a team and a consistent storefront.</Text>
        <AppButton label="Select Business" variant={selection === 'shop' ? 'primary' : 'secondary'} onPress={() => setSelection('shop')} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Solo vendor</Text>
        <Text style={styles.body}>Best for independent mobile mechanics traveling directly to customers.</Text>
        <AppButton label="Select Solo Vendor" variant={selection === 'solo' ? 'primary' : 'secondary'} onPress={() => setSelection('solo')} />
      </AppCard>

      <View style={styles.footer}>
        <AppButton
          label="Finish Vendor Setup"
          variant="accent"
          onPress={async () => {
            await setRole('vendor', selection);
            router.replace('/(vendor)');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  card: {
    gap: spacing.md,
  },
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
