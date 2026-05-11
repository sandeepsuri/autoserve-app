import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { colors, spacing, typography } from '@/constants/theme';
import { listBookingsForCurrentUser } from '@/lib/bookings';

export default function VendorDashboardScreen() {
  const { data: bookings = [] } = useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: listBookingsForCurrentUser,
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

      {bookings.length ? (
        bookings.slice(0, 3).map((booking) => (
          <AppCard key={booking.id}>
            <Text style={typography.titleSm}>{booking.id}</Text>
            <Text style={styles.subtitle}>{booking.scheduledAt}</Text>
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
