import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { colors, typography } from '@/constants/theme';
import { listBookingsForCurrentUser } from '@/lib/bookings';

export default function ClientBookingsScreen() {
  const { data: bookings = [] } = useQuery({
    queryKey: ['client-bookings'],
    queryFn: listBookingsForCurrentUser,
  });

  return (
    <Screen>
      <Text style={typography.titleLg}>Your bookings</Text>
      <Text style={styles.subtitle}>Track confirmed and pending service requests here.</Text>

      {bookings.length ? (
        bookings.map((booking) => (
          <BookingSummaryCard
            key={booking.id}
            title={booking.id}
            rows={[
              { label: 'Status', value: booking.status },
              { label: 'Mode', value: booking.bookingMode },
              { label: 'Scheduled', value: booking.scheduledAt },
              { label: 'Total', value: `$${booking.total.toFixed(2)}` },
            ]}
          />
        ))
      ) : (
        <EmptyState title="No bookings yet" body="Start with a nearby shop or mobile mechanic and your booking history will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
