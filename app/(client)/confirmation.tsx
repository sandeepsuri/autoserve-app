import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { getBookingById } from '@/lib/bookings';

export default function ConfirmationScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-confirmation', bookingId],
    queryFn: () => getBookingById(bookingId),
    enabled: Boolean(bookingId),
  });

  if (!bookingId) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)" />
        <EmptyState title="Booking not found" body="We couldn’t load a booking reference for this confirmation screen." />
      </Screen>
    );
  }

  const servicesLabel = booking?.services.map((service) => service.title).join(', ') || 'Loading services…';
  const scheduleLabel =
    booking?.appointmentDate && booking?.appointmentTime
      ? `${booking.appointmentDate} · ${booking.appointmentTime}`
      : booking?.scheduledAt ?? 'Loading appointment…';

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={typography.titleLg}>Booking confirmed</Text>
      <Text style={styles.subtitle}>
        {isLoading
          ? `Loading booking ${bookingId}…`
          : `Your request is in and visible in My Bookings. Reference: ${bookingId}`}
      </Text>

      <BookingSummaryCard
        title="Booking summary"
        rows={[
          { label: 'Vendor', value: booking?.vendorName ?? 'Loading vendor…' },
          { label: 'Services', value: servicesLabel },
          { label: 'Date & Time', value: scheduleLabel },
          { label: 'Status', value: booking?.status ?? 'pending' },
        ]}
      />

      <BookingSummaryCard
        title="Next steps"
        rows={[
          { label: 'Tracking', value: 'Follow status changes in My Bookings' },
          { label: 'Service type', value: booking?.bookingMode === 'mobile' ? 'Mobile Service' : 'Shop Visit' },
          { label: 'Estimate', value: booking ? `$${booking.total.toFixed(2)}` : 'Loading total…' },
        ]}
      />

      <AppButton label="View My Bookings" variant="accent" onPress={() => router.replace('/(client)/bookings')} />
      <AppButton label="Back to Discovery" variant="secondary" onPress={() => router.replace('/(client)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtleGreen,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: spacing.sm,
  },
  check: {
    fontSize: 42,
    color: colors.surfaceSuccess,
    lineHeight: 44,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
