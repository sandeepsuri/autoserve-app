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
  const { session, postAuthPath, setPostAuthPath } = useAuthStore();

  useEffect(() => {
    if (!session) router.replace('/(auth)');
  }, [session, router]);

  if (!session) return null;

  return (
    <Screen contentStyle={styles.container}>
      <AppHeader
        title="Welcome to AutoServe"
        subtitle="Book service as a driver, or apply to list your shop on the marketplace after review."
        fallbackHref="/(auth)"
      />

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Client App</Text>
        <Text style={styles.body}>
          Browse nearby providers, select your vehicle, and complete bookings in a few quick steps.
        </Text>
        <AppButton
          label="Continue as Client"
          onPress={async () => {
            const nextPath = postAuthPath;
            await setRole('client');
            setPostAuthPath(null);
            router.replace((nextPath as never) || '/(client)');
          }}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Apply as a Vendor</Text>
        <Text style={styles.body}>
          Submit your business for review. You will not appear in discovery until an AutoServe admin approves
          your application.
        </Text>
        <AppButton
          label="Apply to Become a Vendor"
          variant="secondary"
          onPress={async () => {
            await setRole('client');
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
