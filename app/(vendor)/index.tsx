import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { colors, spacing, typography } from '@/constants/theme';
import { listBookingsForVendorOwner } from '@/lib/bookings';
import { formatScheduledEST } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorDashboardScreen() {
  const userId = useAuthStore((s) => s.session?.userId ?? 'anon');
  const { data: bookings = [], error } = useQuery({
    queryKey: ['vendor-bookings', 'vendor', userId],
    queryFn: () => listBookingsForVendorOwner(userId),
    enabled: userId !== 'anon',
  });

  const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length;
  const pending = bookings.filter((booking) => booking.status === 'pending').length;
  const earnings = bookings.filter((booking) => booking.status !== 'cancelled').reduce((sum, booking) => sum + booking.total, 0);

  return (
    <Screen>
      <Text style={typography.titleLg}>Vendor dashboard</Text>
      <Text style={styles.subtitle}>Monitor upcoming work, earnings, and customer activity from one operational hub.</Text>

      <View style={styles.row}>
        <StatCard label="Confirmed bookings" value={`${confirmed}`} helper={`${pending} pending review`} />
        <StatCard label="Earnings this week" value={`$${earnings.toFixed(0)}`} helper="+12% vs last week" />
      </View>

      <AppCard>
        <Text style={typography.titleSm}>Manage services</Text>
        <Text style={styles.subtitle}>Update pricing, durations, and mobile-service availability to stay accurate in discovery.</Text>
      </AppCard>

      {error ? (
        <EmptyState
          title="Could not load bookings"
          body={error instanceof Error ? error.message : 'Please try again after refreshing the screen.'}
        />
      ) : bookings.length ? (
        bookings.slice(0, 3).map((booking) => (
          <AppCard key={booking.id}>
            <Text style={typography.titleSm}>{booking.clientName || 'Client'}</Text>
            <Text style={styles.subtitle}>{`${booking.vehicleLabel} - ${booking.services.map((s) => s.title).join(' · ')}`}</Text>
            <Text style={styles.subtitle}>{formatScheduledEST(booking.scheduledAt)}</Text>
            <Text style={styles.notes}>{booking.notes}</Text>
            <Text style={styles.status}>{booking.status.toUpperCase()}</Text>
          </AppCard>
        ))
      ) : (
        <EmptyState title="No bookings yet" body="Once customers begin submitting requests, today’s queue will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.bodyMd,
    color: colors.info,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  status: {
    ...typography.labelMd,
    color: colors.surfaceAccent,
    marginTop: spacing.sm,
  },
});
