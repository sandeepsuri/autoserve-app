import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

export default function WelcomeScreen() {
  const router = useRouter();
  const setGuestMode = useAuthStore((state) => state.setGuestMode);

  return (
    <Screen scroll={false} contentStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>AutoServe</Text>
        <Text style={styles.tagline}>Premium automotive care at your fingertips.</Text>
      </View>

      <View style={styles.hero}>
        <Image
          source="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80"
          style={styles.heroImage}
          contentFit="cover"
        />
        <AppCard style={styles.overlayCard}>
          <Text style={typography.titleSm}>Transparency every turn.</Text>
          <Text style={styles.overlayText}>Certified technicians, upfront pricing, and mobile service options when you need them most.</Text>
        </AppCard>
      </View>

      <View style={styles.actions}>
        <AppButton
          label="Continue as Guest"
          variant="accent"
          onPress={() => {
            setGuestMode(true);
            router.replace('/(public)/discover');
          }}
        />
        <View style={styles.inline}>
          <AppButton label="Sign Up" variant="secondary" style={styles.half} onPress={() => router.push('/(auth)')} />
          <AppButton label="Log In" style={styles.half} onPress={() => router.push('/(auth)')} />
        </View>
      </View>

      <Text style={styles.footer}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: colors.bgBase,
  },
  header: {
    gap: spacing.md,
    paddingTop: spacing.section,
  },
  brand: {
    ...typography.displayMd,
    color: colors.bgStrong,
  },
  tagline: {
    ...typography.bodyLg,
    color: colors.textSecondary,
  },
  hero: {
    gap: spacing.lg,
  },
  heroImage: {
    width: '100%',
    height: 300,
    borderRadius: 28,
  },
  overlayCard: {
    marginTop: -40,
    marginHorizontal: spacing.lg,
  },
  overlayText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  inline: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  footer: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
