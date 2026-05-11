import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';

export default function PremiumScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.container}>
      <AppHeader title="Premium Feature" fallbackHref="/(client)/vehicle/confirm" />
      <View style={styles.cameraStub}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.premiumTitle}>Auto Vehicle Detection</Text>
        <Text style={styles.premiumBody}>Upgrade to Premium to auto-detect your vehicle with just a photo. Manual selection remains available anytime.</Text>
      </View>

      <AppCard>
        <Text style={typography.titleSm}>Why unlock it?</Text>
        <Text style={styles.listItem}>• Instant make, model, and year suggestions</Text>
        <Text style={styles.listItem}>• Faster repeat bookings</Text>
        <Text style={styles.listItem}>• Better service recommendations</Text>
      </AppCard>

      <AppButton label="Unlock Premium Feature" variant="accent" />
      <AppButton label="Back to Vehicle Flow" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  cameraStub: {
    backgroundColor: colors.bgStrong,
    borderRadius: 28,
    padding: spacing.section,
    alignItems: 'center',
    gap: spacing.lg,
  },
  lock: {
    fontSize: 48,
  },
  premiumTitle: {
    ...typography.titleLg,
    color: colors.textInverse,
    textAlign: 'center',
  },
  premiumBody: {
    ...typography.bodyMd,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  listItem: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
