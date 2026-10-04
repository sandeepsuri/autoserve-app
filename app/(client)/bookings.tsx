import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { listBookingsForCurrentUser } from '@/lib/bookings';
import { useAuthStore } from '@/store/useAuthStore';
import { BookingRecord } from '@/types/domain';

type Tab = 'upcoming' | 'history';

function isUpcoming(status: BookingRecord['status']) {
  return status === 'pending' || status === 'confirmed';
}

export default function ClientBookingsScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [tab, setTab] = useState<Tab>('upcoming');

  const { data: bookings = [], refetch, isRefetching } = useQuery({
    queryKey: ['client-bookings'],
    queryFn: listBookingsForCurrentUser,
    enabled: Boolean(session),
  });

  const filtered = bookings.filter((b) =>
    tab === 'upcoming' ? isUpcoming(b.status) : !isUpcoming(b.status),
  );

  if (!session) {
    return (
      <Screen>
        <Text style={typography.titleLg}>Your bookings</Text>
        <EmptyState
          title="Sign in to view bookings"
          body="Guests can browse and build a booking draft, but saved bookings are tied to a signed-in client account."
        />
        <AppButton label="Sign In" variant="primary" onPress={() => router.push('/(auth)')} />
      </Screen>
    );
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.surfaceAccent} />}>
      <Text style={typography.titleLg}>Your bookings</Text>
      <Text style={styles.subtitle}>Track confirmed and pending service requests here.</Text>

      <View style={styles.tabs}>
        <FilterChip label="Upcoming" active={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <FilterChip label="History"  active={tab === 'history'}  onPress={() => setTab('history')} />
      </View>

      {filtered.length ? (
        filtered.map((booking) => {
          const pill = STATUS_COLORS[booking.status];
          const schedule =
            booking.appointmentDate && booking.appointmentTime
              ? `${booking.appointmentDate} · ${booking.appointmentTime}`
              : booking.scheduledAt;
          const location =
            booking.bookingMode === 'mobile' && booking.mobileAddress
              ? booking.mobileAddress
              : 'At the shop';

          return (
            <Pressable key={booking.id} onPress={() => router.push(`/(client)/booking-detail/${booking.id}`)}>
              <AppCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[typography.titleSm, styles.vendorName]} numberOfLines={1}>
                    {booking.vendorName ?? 'Unknown vendor'}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.fg }]}>{STATUS_LABEL[booking.status]}</Text>
                  </View>
                </View>

                {booking.publicReference ? (
                  <Text style={styles.reference} numberOfLines={1}>
                    Reference: {booking.publicReference}
                  </Text>
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
              </AppCard>
            </Pressable>
          );
        })
      ) : tab === 'upcoming' ? (
        <EmptyState
          title="No upcoming bookings"
          body="Book a nearby shop or mobile mechanic to see your appointments here."
        />
      ) : (
        <EmptyState
          title="No booking history yet"
          body="Once you've completed an appointment, it'll show up here."
        />
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
  vendorName: {
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
  services: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  reference: {
    ...typography.caption,
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
});
