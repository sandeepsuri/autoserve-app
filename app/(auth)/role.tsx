import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { setRole } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { session, postAuthPath } = useAuthStore();

  useEffect(() => {
    if (!session) router.replace('/(auth)');
  }, [session, router]);

  if (!session) return null;

  return (
    <Screen contentStyle={styles.container}>
      <AppHeader
        title="Choose your AutoServe experience"
        subtitle="One account, two paths: book service as a driver or manage jobs as a vendor."
        fallbackHref="/(auth)"
      />

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Client App</Text>
        <Text style={styles.body}>Browse nearby providers, select your vehicle, and complete bookings in a few quick steps.</Text>
        <AppButton
          label="Continue as Client"
          onPress={async () => {
            await setRole('client');
            router.replace((postAuthPath as never) || '/(client)');
          }}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Vendor App</Text>
        <Text style={styles.body}>Set up your shop, manage services, define your mobile radius, and accept bookings.</Text>
        <AppButton
          label="Continue as Vendor"
          variant="secondary"
          onPress={async () => {
            await setRole('vendor');
            router.push('/(auth)/vendor-setup');
          }}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  card: {
    gap: spacing.lg,
  },
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
