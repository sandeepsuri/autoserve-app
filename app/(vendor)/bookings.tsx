import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { listBookingsForVendorOwner, updateBookingStatus } from '@/lib/bookings';
import { formatScheduledEST } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { BookingRecord } from '@/types/domain';

type StatusTab = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function VendorBookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('pending');
  const userId = useAuthStore((s) => s.session?.userId ?? 'anon');

  const { data: bookings = [], error } = useQuery({
    queryKey: ['vendor-bookings', 'vendor', userId],
    queryFn: () => listBookingsForVendorOwner(userId),
    enabled: userId !== 'anon',
  });

  const filtered = bookings.filter((b) => b.status === tab);

  const accept = async (booking: BookingRecord) => {
    await updateBookingStatus(booking.id, 'confirmed');
    await queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
  };

  const reject = async (booking: BookingRecord) => {
    await updateBookingStatus(booking.id, 'cancelled');
    await queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
  };

  return (
    <Screen>
      <Text style={typography.titleLg}>Booking management</Text>
      <Text style={styles.subtitle}>{"Review new requests quickly and keep today’s load balanced."}</Text>

      <View style={styles.tabs}>
        <FilterChip label="Pending"   active={tab === 'pending'}   onPress={() => setTab('pending')}   />
        <FilterChip label="Confirmed" active={tab === 'confirmed'} onPress={() => setTab('confirmed')} />
        <FilterChip label="Completed" active={tab === 'completed'} onPress={() => setTab('completed')} />
        <FilterChip label="Cancelled" active={tab === 'cancelled'} onPress={() => setTab('cancelled')} />
      </View>

      {error ? (
        <EmptyState
          title="Could not load bookings"
          body={error instanceof Error ? error.message : 'Please try again after refreshing the screen.'}
        />
      ) : null}

      {!error && filtered.length ? (
        filtered.map((booking) => {
          const pill = STATUS_COLORS[booking.status];
          const schedule =
            booking.appointmentDate && booking.appointmentTime
              ? `${booking.appointmentDate} · ${booking.appointmentTime}`
              : formatScheduledEST(booking.scheduledAt);
          const location =
            booking.bookingMode === 'mobile' && booking.mobileAddress
              ? booking.mobileAddress
              : 'At the shop';

          return (
            <Pressable key={booking.id} onPress={() => router.push(`/(vendor)/booking-detail/${booking.id}`)}>
              <AppCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[typography.titleSm, styles.clientName]} numberOfLines={1}>
                    {booking.clientName ?? 'Client'}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.fg }]}>{STATUS_LABEL[booking.status]}</Text>
                  </View>
                </View>

                {booking.vehicleLabel ? (
                  <Text style={styles.vehicle}>{booking.vehicleLabel}</Text>
                ) : null}

                <Text style={styles.services} numberOfLines={1}>
                  {booking.services.length
                    ? booking.services.map((s) => s.title).join(' · ')
                    : '—'}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{schedule}</Text>
                  <Text style={styles.meta}>{`$${booking.total.toFixed(2)}`}</Text>
                </View>

                <Text style={styles.location}>{location}</Text>

                {booking.status === 'pending' ? (
                  <View style={styles.actions}>
                    <AppButton label="Accept" variant="accent"     style={styles.actionButton} onPress={() => accept(booking)} />
                    <AppButton label="Reject" variant="secondary"  style={styles.actionButton} onPress={() => reject(booking)} />
                  </View>
                ) : null}
              </AppCard>
            </Pressable>
          );
        })
      ) : !error ? (
        <EmptyState
          title={`No ${tab} bookings`}
          body="As new requests arrive, they will appear in the correct status tab here."
        />
      ) : null}
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
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  clientName: {
    flex: 1,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  vehicle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  services: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  location: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
});
