import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { listBookingsForVendorOwner } from '@/lib/bookings';
import { formatScheduledEST } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { BookingRecord } from '@/types/domain';

function parseAppointmentStart(booking: BookingRecord): Date | null {
  if (booking.appointmentDate && booking.appointmentTime) {
    const date = new Date(`${booking.appointmentDate}T${booking.appointmentTime}:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fallback = new Date(booking.scheduledAt);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function upcomingBookings(bookings: BookingRecord[], limit: number) {
  const now = Date.now();
  return bookings
    .map((booking) => ({ booking, startsAt: parseAppointmentStart(booking) }))
    .filter(
      (entry): entry is { booking: BookingRecord; startsAt: Date } =>
        entry.startsAt !== null &&
        entry.startsAt.getTime() >= now &&
        entry.booking.status !== 'cancelled' &&
        entry.booking.status !== 'completed',
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);
}

function formatAppointmentDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatAppointmentTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function serviceSummary(booking: BookingRecord) {
  return booking.services.length ? booking.services.map((service) => service.title).join(' · ') : 'Service request';
}

export default function VendorDashboardScreen() {
  const userId = useAuthStore((s) => s.session?.userId ?? 'anon');
  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['vendor-bookings', 'vendor', userId],
    queryFn: () => listBookingsForVendorOwner(userId),
    enabled: userId !== 'anon',
  });

  const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length;
  const pending = bookings.filter((booking) => booking.status === 'pending').length;
  const earnings = bookings.filter((booking) => booking.status !== 'cancelled').reduce((sum, booking) => sum + booking.total, 0);
  const nextBookings = useMemo(() => upcomingBookings(bookings, 3), [bookings]);

  return (
    <Screen>
      <Text style={typography.titleLg}>Vendor dashboard</Text>
      <Text style={styles.subtitle}>Monitor upcoming work, earnings, and customer activity from one operational hub.</Text>

      <View style={styles.row}>
        <StatCard label="Confirmed bookings" value={`${confirmed}`} helper={`${pending} pending review`} />
        <StatCard label="Earnings this week" value={`$${earnings.toFixed(0)}`} helper="+12% vs last week" />
      </View>

      <View style={[styles.upNextCard, shadows.card]}>
        <View style={styles.upNextHeader}>
          <View>
            <Text style={styles.upNextTitle}>Up Next</Text>
            <Text style={styles.upNextSubtitle}>Next 3 appointments</Text>
          </View>
          <View style={styles.upNextBadge}>
            <Text style={styles.upNextBadgeText}>{nextBookings.length ? 'Live' : 'Clear'}</Text>
          </View>
        </View>

        {isLoading ? (
          <Text style={styles.upNextEmpty}>Loading upcoming appointments...</Text>
        ) : nextBookings.length ? (
          <View style={styles.upNextList}>
            {nextBookings.map(({ booking, startsAt }) => {
              const pill = STATUS_COLORS[booking.status];
              return (
                <View key={booking.id} style={styles.upNextRow}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeText}>{formatAppointmentTime(startsAt)}</Text>
                    <Text style={styles.dayText}>{formatAppointmentDay(startsAt)}</Text>
                  </View>
                  <View style={styles.upNextCopy}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {booking.clientName ?? 'Client'}
                    </Text>
                    {booking.publicReference ? (
                      <Text style={styles.upNextReference} numberOfLines={1}>
                        Reference: {booking.publicReference}
                      </Text>
                    ) : null}
                    <Text style={styles.appointmentMeta} numberOfLines={2}>
                      {serviceSummary(booking)}
                    </Text>
                    <Text style={styles.appointmentMeta} numberOfLines={1}>
                      {booking.vehicleLabel ?? 'Vehicle pending'}
                    </Text>
                    <View style={styles.metaPills}>
                      <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.statusPillText, { color: pill.fg }]}>{STATUS_LABEL[booking.status]}</Text>
                      </View>
                      <View style={styles.modePill}>
                        <Text style={styles.modePillText}>
                          {booking.bookingMode === 'mobile' ? 'Mobile' : 'Shop'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.upNextEmpty}>No upcoming appointments. Confirmed work will appear here chronologically.</Text>
        )}
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
            {booking.publicReference ? (
              <Text style={styles.reference}>Reference: {booking.publicReference}</Text>
            ) : null}
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
  reference: {
    ...typography.caption,
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
  upNextCard: {
    backgroundColor: colors.bgStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  upNextHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  upNextTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textInverse,
  },
  upNextSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#CBD5E1',
    marginTop: spacing.xs,
  },
  upNextBadge: {
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  upNextBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textInverse,
  },
  upNextList: {
    gap: spacing.md,
  },
  upNextReference: {
    ...typography.caption,
    color: '#CBD5E1',
  },
  upNextRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
  },
  timeBlock: {
    width: 76,
    flexShrink: 0,
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    lineHeight: 20,
    color: colors.textInverse,
  },
  dayText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: '#CBD5E1',
    marginTop: 2,
  },
  upNextCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  customerName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 19,
    color: colors.textInverse,
  },
  appointmentMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#CBD5E1',
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 13,
  },
  modePill: {
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  modePillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 13,
    color: colors.textInverse,
  },
  upNextEmpty: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#CBD5E1',
  },
});
