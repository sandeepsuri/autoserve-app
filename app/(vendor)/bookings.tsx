import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { listBookingsForCurrentUser, updateBookingStatus } from '@/lib/bookings';

export default function VendorBookingsScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'completed'>('pending');
  const { data: bookings = [] } = useQuery({
    queryKey: ['vendor-bookings-status'],
    queryFn: listBookingsForCurrentUser,
  });

  const filtered = bookings.filter((booking) => booking.status === status);

  return (
    <Screen>
      <Text style={typography.titleLg}>Booking management</Text>
      <Text style={styles.subtitle}>Review new requests quickly and keep today’s load balanced across the day.</Text>

      <View style={styles.tabs}>
        <FilterChip label="Pending" active={status === 'pending'} onPress={() => setStatus('pending')} />
        <FilterChip label="Confirmed" active={status === 'confirmed'} onPress={() => setStatus('confirmed')} />
        <FilterChip label="Completed" active={status === 'completed'} onPress={() => setStatus('completed')} />
      </View>

      {filtered.length ? (
        filtered.map((booking) => (
          <AppCard key={booking.id} style={styles.bookingCard}>
            <Text style={typography.titleSm}>{booking.clientName ?? booking.id}</Text>
            <Text style={styles.subtitle}>{booking.services[0]?.title ?? '—'}</Text>
            <Text style={styles.subtitle}>{booking.scheduledAt}</Text>
            <Text style={styles.subtitle}>Mode: {booking.bookingMode}</Text>
            {booking.status === 'pending' ? (
              <View style={styles.actions}>
                <AppButton
                  label="Accept"
                  variant="accent"
                  style={styles.actionButton}
                  onPress={async () => {
                    await updateBookingStatus(booking.id, 'confirmed');
                    await queryClient.invalidateQueries({ queryKey: ['vendor-bookings-status'] });
                  }}
                />
                <AppButton
                  label="Reject"
                  variant="secondary"
                  style={styles.actionButton}
                  onPress={async () => {
                    await updateBookingStatus(booking.id, 'cancelled');
                    await queryClient.invalidateQueries({ queryKey: ['vendor-bookings-status'] });
                  }}
                />
              </View>
            ) : null}
            <AppButton label="Message Customer" variant="secondary" style={styles.messageButton} />
          </AppCard>
        ))
      ) : (
        <EmptyState title={`No ${status} bookings`} body="As new requests arrive, they will appear in the correct status tab here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  bookingCard: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  messageButton: {
    minHeight: 46,
  },
});
