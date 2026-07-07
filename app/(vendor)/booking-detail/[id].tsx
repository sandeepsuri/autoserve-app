import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { bookingPaymentLabel, getBookingById, updateBookingStatus } from '@/lib/bookings';
import { captureBookingPayment, cancelBookingPayment } from '@/lib/payments';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentVendorPayoutStatus } from '@/lib/vendor-payouts';

export default function VendorBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => getBookingById(id),
    enabled: Boolean(id),
  });

  const { data: vendor } = useQuery({
    queryKey: ['vendor-payout-status'],
    queryFn: getCurrentVendorPayoutStatus,
  });

  if (isLoading) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(vendor)/bookings" />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(vendor)/bookings" />
        <EmptyState
          title="Booking not found"
          body="This booking may have been removed or is no longer accessible."
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

  const payoutReady = !isSupabaseConfigured || vendor?.stripeTransfersStatus === 'active';

  const mutate = async (status: 'confirmed' | 'cancelled' | 'completed') => {
    setBusy(true);
    try {
      if (status === 'confirmed') {
        await captureBookingPayment(booking.id);
      } else if (status === 'cancelled' && booking.status === 'pending') {
        await cancelBookingPayment(booking.id);
      } else {
        await updateBookingStatus(booking.id, status);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['client-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-detail', id] }),
      ]);
      router.back();
    } catch (err) {
      Alert.alert('Could not update booking', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const serviceRows = booking.services.map((s) => ({
    label: s.title,
    value: `$${s.price.toFixed(2)}`,
  }));

  return (
    <Screen>
      <AppHeader fallbackHref="/(vendor)/bookings" title="Booking detail" />

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusText, { color: pill.fg }]}>{STATUS_LABEL[booking.status]}</Text>
        </View>
      </View>

      <BookingSummaryCard
        title="Customer"
        rows={[
          { label: 'Name',    value: booking.clientName ?? '—' },
          { label: 'Vehicle', value: booking.vehicleLabel ?? '—' },
        ]}
      />

      {serviceRows.length ? (
        <BookingSummaryCard title="Services" rows={serviceRows} />
      ) : null}

      <BookingSummaryCard
        title="Schedule"
        rows={[
          { label: 'Date & Time', value: schedule },
          { label: 'Mode',        value: booking.bookingMode === 'mobile' ? 'Mobile service' : 'At the shop' },
          { label: 'Location',    value: location },
        ]}
      />

      <BookingSummaryCard
        title="Pricing"
        rows={[
          { label: 'Subtotal',    value: `$${booking.subtotal.toFixed(2)}` },
          { label: 'Service fee', value: `$${booking.serviceFee.toFixed(2)}` },
          { label: 'Total',       value: `$${booking.total.toFixed(2)}` },
          { label: 'Payment',     value: bookingPaymentLabel(booking) },
        ]}
      />

      {booking.notes ? (
        <BookingSummaryCard
          title="Problem description"
          rows={[{ label: 'From client', value: booking.notes }]}
        />
      ) : null}

      {booking.photos && booking.photos.length > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {booking.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.photo} resizeMode="cover" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.actions}>
        {booking.status === 'pending' ? (
          <>
            {payoutReady ? null : (
              <Text style={styles.payoutGate}>Payouts not set up — the client will pay at the shop.</Text>
            )}
            <AppButton label={busy ? 'Accepting…' : 'Accept booking'}  variant="accent"    disabled={busy} onPress={() => mutate('confirmed')} />
            <AppButton label={busy ? 'Rejecting…' : 'Reject booking'}  variant="secondary" disabled={busy} onPress={() => mutate('cancelled')} />
          </>
        ) : null}

        {booking.status === 'confirmed' ? (
          <>
            <AppButton label={busy ? 'Updating…' : 'Mark completed'} variant="accent"    disabled={busy} onPress={() => mutate('completed')} />
            <AppButton label={busy ? 'Cancelling…' : 'Cancel booking'} variant="secondary" disabled={busy} onPress={() => mutate('cancelled')} />
          </>
        ) : null}

        {/* TODO: messaging layer not yet implemented */}
        <AppButton label="Message customer" variant="secondary" disabled />
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
  sectionTitle: {
    ...typography.titleSm,
    marginBottom: spacing.sm,
  },
  photoScroll: {
    marginBottom: spacing.md,
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: spacing.sm,
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
  payoutGate: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
