import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { getCurrentVendorPayoutStatus, startVendorPayoutOnboarding } from '@/lib/vendor-payouts';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, session } = useAuthStore();
  const [startingPayouts, setStartingPayouts] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ['vendor-payout-status', session?.userId],
    queryFn: getCurrentVendorPayoutStatus,
    enabled: Boolean(session),
  });

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  const payoutStatus = vendor?.stripeTransfersStatus ?? 'inactive';
  const payoutCopy =
    payoutStatus === 'active'
      ? 'Payouts active'
      : payoutStatus === 'pending'
        ? 'Setup pending'
        : 'Setup required';

  const handlePayoutSetup = async () => {
    setStartingPayouts(true);
    try {
      const session = await startVendorPayoutOnboarding();
      await WebBrowser.openAuthSessionAsync(session.url, 'autoserve://vendor/profile');
      await queryClient.invalidateQueries({ queryKey: ['vendor-payout-status'] });
    } catch (err) {
      Alert.alert('Could not start payout setup', err instanceof Error ? err.message : String(err));
    } finally {
      setStartingPayouts(false);
    }
  };

  return (
    <Screen>
      <Text style={typography.titleLg}>Vendor profile</Text>
      <BookingSummaryCard
        title="Business profile"
        rows={[
          { label: 'Contact', value: profile?.fullName ?? 'Vendor' },
          { label: 'Email', value: session?.email ?? 'No email' },
          { label: 'Account type', value: profile?.businessType ?? 'shop' },
        ]}
      />

      <AppCard>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Payouts</Text>
            <Text style={styles.cardBody}>Stripe-hosted onboarding is required before accepting paid bookings.</Text>
          </View>
          <Text style={[styles.status, payoutStatus === 'active' && styles.statusActive]}>{payoutCopy}</Text>
        </View>
        <AppButton
          label={startingPayouts ? 'Opening...' : payoutStatus === 'active' ? 'Manage payouts' : 'Set up payouts'}
          variant={payoutStatus === 'active' ? 'secondary' : 'accent'}
          disabled={startingPayouts}
          onPress={handlePayoutSetup}
        />
      </AppCard>

      <AppButton label="Sign Out" variant="secondary" onPress={handleSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  cardBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  status: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  statusActive: {
    color: colors.surfaceBrand,
  },
});
