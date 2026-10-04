import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { formatTimeDisplay } from '@/store/useVendorAvailabilityStore';

export default function GuestBookingConfirmationScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const router = useRouter();
  const booking = useBookingDraftStore((state) => state.submittedGuestBooking);
  if (!booking || booking.vendorId !== vendorId) return <Screen><AppHeader fallbackHref="/(public)/discover" /><EmptyState title="Confirmation unavailable" body="This guest confirmation is available immediately after submitting a request. Check your email for the booking reference." /><AppButton label="Back to discovery" onPress={() => router.replace('/(public)/discover')} /></Screen>;

  return <Screen contentStyle={styles.content}>
    <View style={styles.mark}><Text style={styles.check}>✓</Text></View><View style={styles.pending}><Text style={styles.pendingText}>Pending vendor review</Text></View>
    <Text style={styles.title}>Your request has been sent</Text><Text style={styles.subtitle}>{booking.vendorName} will review it. Status updates will be emailed to {booking.guestEmail}.</Text>
    <View style={styles.reference}><Text style={styles.referenceLabel}>Booking reference</Text><Text style={styles.referenceValue}>{booking.publicReference ?? booking.id}</Text></View>
    <BookingSummaryCard title="Request summary" rows={[{ label: 'Vendor', value: booking.vendorName ?? 'Selected vendor' }, { label: 'Vehicle', value: booking.vehicleLabel ?? 'Vehicle supplied' }, { label: 'Date & time', value: `${booking.appointmentDate} · ${booking.appointmentTime ? formatTimeDisplay(booking.appointmentTime) : ''}` }, { label: 'Status', value: 'Pending review' }, { label: 'Payment', value: 'Pay vendor directly' }]} />
    <AppButton label="Back to discovery" variant="accent" onPress={() => router.replace('/(public)/discover')} /><AppButton label="Return to vendor" variant="secondary" onPress={() => router.replace(`/(public)/shop/${vendorId}`)} />
  </Screen>;
}

const styles = StyleSheet.create({ content: { justifyContent: 'center' }, mark: { width: 84, height: 84, borderRadius: 42, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtleGreen, borderWidth: 1, borderColor: '#BBF7D0' }, check: { fontSize: 40, color: colors.surfaceSuccess }, pending: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceSubtleOrange }, pendingText: { ...typography.caption, color: colors.pending }, title: { ...typography.titleLg, textAlign: 'center' }, subtitle: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center' }, reference: { backgroundColor: colors.bgStrong, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', gap: spacing.xs }, referenceLabel: { ...typography.caption, color: '#CBD5E1' }, referenceValue: { ...typography.titleMd, color: colors.textInverse, letterSpacing: 2 } });
