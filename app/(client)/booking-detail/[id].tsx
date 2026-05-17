import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { getBookingById, updateBookingStatus } from '@/lib/bookings';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => getBookingById(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)/bookings" />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)/bookings" />
        <EmptyState
          title="Booking not found"
          body="This booking may have been removed or the link is no longer valid."
        />
      </Screen>
    );
  }

  const pill = STATUS_COLORS[booking.status];
  const schedule =
    booking.appointmentDate && booking.appointmentTime
      ? `${booking.appointmentDate} · ${booking.appointmentTime}`
      : booking.scheduledAt;
  const location =
    booking.bookingMode === 'mobile' && booking.mobileAddress
      ? booking.mobileAddress
      : 'At the shop';

  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await updateBookingStatus(booking.id, 'cancelled');
      await queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['client-bookings'] });
      router.back();
    } finally {
      setCancelling(false);
    }
  };

  const serviceRows = booking.services.map((s) => ({
    label: s.title,
    value: `$${s.price.toFixed(2)}`,
  }));

  return (
    <Screen>
      <AppHeader fallbackHref="/(client)/bookings" title="Booking detail" />

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusText, { color: pill.fg }]}>{STATUS_LABEL[booking.status]}</Text>
        </View>
      </View>

      <BookingSummaryCard
        title={booking.vendorName ?? 'Booking summary'}
        rows={[
          { label: 'Date & Time', value: schedule },
          { label: 'Mode', value: booking.bookingMode === 'mobile' ? 'Mobile service' : 'At the shop' },
          { label: 'Location', value: location },
        ]}
      />

      {serviceRows.length ? (
        <BookingSummaryCard
          title="Services"
          rows={serviceRows}
        />
      ) : null}

      <BookingSummaryCard
        title="Pricing"
        rows={[
          { label: 'Subtotal', value: `$${booking.subtotal.toFixed(2)}` },
          { label: 'Service fee', value: `$${booking.serviceFee.toFixed(2)}` },
          { label: 'Total', value: `$${booking.total.toFixed(2)}` },
        ]}
      />

      {booking.notes ? (
        <BookingSummaryCard
          title="Notes"
          rows={[{ label: 'From you', value: booking.notes }]}
        />
      ) : null}

      <View style={styles.actions}>
        {canCancel ? (
          <AppButton
            label={cancelling ? 'Cancelling…' : 'Cancel booking'}
            variant="secondary"
            disabled={cancelling}
            onPress={handleCancel}
          />
        ) : null}

        {/* TODO: Reschedule — requires a date/time update endpoint not yet implemented */}
        <AppButton label="Reschedule" variant="secondary" disabled />
        <Text style={styles.comingSoon}>Rescheduling coming soon</Text>

        {/* TODO: Message vendor — requires a messaging layer not yet implemented */}
        <AppButton label="Message vendor" variant="secondary" disabled />
        <Text style={styles.comingSoon}>Messaging coming soon</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
  },
  comingSoon: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
});
