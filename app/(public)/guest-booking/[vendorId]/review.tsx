import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { createGuestBookingFromSelections } from '@/lib/bookings';
import { queryClient } from '@/lib/query-client';
import { getVendorDetail } from '@/lib/vendors';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { formatTimeDisplay } from '@/store/useVendorAvailabilityStore';

export default function GuestBookingReviewScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const router = useRouter();
  const { draft, clearDraft, setSubmittedGuestBooking } = useBookingDraftStore();
  const [consent, setConsent] = useState(Boolean(draft.guestContactConsent));
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(Crypto.randomUUID()).current;
  const { data, isLoading } = useQuery({ queryKey: ['guest-booking-vendor', vendorId], queryFn: () => getVendorDetail(vendorId), enabled: Boolean(vendorId) });

  if (isLoading) return <Screen><AppHeader title="Review request" fallbackHref={`/(public)/guest-booking/${vendorId}/details` as never} /></Screen>;
  const vendor = data?.vendor;
  const selectedServices = (data?.services ?? []).filter((service) => (draft.serviceIds ?? []).includes(service.id));
  const complete = Boolean(vendor && draft.guestName && draft.guestEmail && draft.guestPhone && draft.vehicleMake && draft.vehicleModel && draft.vehicleYear && selectedServices.length && draft.scheduledDate && draft.scheduledTime && draft.bookingMode);
  if (!complete || !vendor) return <Screen><AppHeader fallbackHref={`/(public)/guest-booking/${vendorId}/details` as never} /><EmptyState title="Booking details are incomplete" body="Return to the form and complete the required contact, vehicle, service, and schedule details." /><AppButton label="Return to form" onPress={() => router.replace(`/(public)/guest-booking/${vendorId}/details`)} /></Screen>;

  const subtotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const total = Math.round(subtotal * 1.12 * 100) / 100;
  const vehicleLabel = `${draft.vehicleYear} ${draft.vehicleMake} ${draft.vehicleModel}${draft.vehicleTrim ? ` ${draft.vehicleTrim}` : ''}`;

  const submit = async () => {
    if (!consent || submitting) return;
    setSubmitting(true);
    try {
      const booking = await createGuestBookingFromSelections({
        vendor: { id: vendor.id, name: vendor.name },
        contact: { name: draft.guestName!, email: draft.guestEmail!, phone: draft.guestPhone! },
        vehicle: { make: draft.vehicleMake!, model: draft.vehicleModel!, year: draft.vehicleYear!, trim: draft.vehicleTrim, color: draft.vehicleColor, plate: draft.vehiclePlate },
        services: selectedServices,
        scheduledDate: draft.scheduledDate!, scheduledTime: draft.scheduledTime!, bookingMode: draft.bookingMode!,
        mobileAddress: draft.mobileAddress, notes: draft.notes, idempotencyKey,
      });
      setSubmittedGuestBooking(booking);
      clearDraft();
      await queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      router.replace(`/(public)/guest-booking/${vendorId}/confirmation`);
    } catch (error) {
      Alert.alert('Could not send request', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSubmitting(false); }
  };

  return <Screen>
    <AppHeader title="Guest booking · Step 2 of 2" subtitle="Review the request before sending it to the vendor." fallbackHref={`/(public)/guest-booking/${vendorId}/details` as never} />
    <View style={styles.progress}><View style={styles.active} /><View style={styles.active} /></View>
    <BookingSummaryCard title="Contact" rows={[{ label: 'Name', value: draft.guestName! }, { label: 'Email', value: draft.guestEmail! }, { label: 'Phone', value: draft.guestPhone! }]} />
    <BookingSummaryCard title="Vehicle" rows={[{ label: 'Vehicle', value: vehicleLabel }, { label: 'Colour / plate', value: [draft.vehicleColor, draft.vehiclePlate].filter(Boolean).join(' · ') || '—' }]} />
    <BookingSummaryCard title="Appointment" rows={[{ label: 'Vendor', value: vendor.name }, { label: 'Services', value: selectedServices.map((service) => service.title).join(', ') }, { label: 'Date & time', value: `${draft.scheduledDate} · ${formatTimeDisplay(draft.scheduledTime!)}` }, { label: 'Visit type', value: draft.bookingMode === 'mobile' ? 'Mobile service' : 'Shop visit' }, { label: 'Estimate', value: `$${total.toFixed(2)}` }]} />
    {draft.notes ? <BookingSummaryCard title="Problem description" rows={[{ label: 'Details', value: draft.notes }]} /> : null}
    <AppCard style={styles.notice}><Text style={styles.noticeTitle}>No payment is due now</Text><Text style={styles.noticeBody}>This request will be pending vendor review. Pay the vendor directly after the service.</Text></AppCard>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((value) => !value)} style={styles.consent}><View style={[styles.checkbox, consent && styles.checked]}>{consent ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.consentText}>I agree that {vendor.name} may use these contact details to respond to this booking request.</Text></Pressable>
    {!consent ? <Text style={styles.helper}>Contact permission is required before submitting.</Text> : null}
    <AppButton label={submitting ? 'Sending request…' : 'Send booking request'} variant="accent" disabled={!consent || submitting} onPress={submit} />
    <AppButton label="Go back and edit" variant="secondary" disabled={submitting} onPress={() => router.back()} />
  </Screen>;
}

const styles = StyleSheet.create({ progress: { flexDirection: 'row', gap: spacing.sm }, active: { flex: 1, height: 5, borderRadius: radius.full, backgroundColor: colors.surfaceAccent }, notice: { backgroundColor: colors.surfaceSubtleOrange, borderColor: '#FED7AA', gap: spacing.xs }, noticeTitle: { ...typography.labelLg }, noticeBody: { ...typography.bodyMd, color: colors.textSecondary }, consent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.surfaceBrand, borderColor: colors.surfaceBrand }, check: { color: colors.textInverse, fontWeight: '700' }, consentText: { ...typography.bodyMd, color: colors.textPrimary, flex: 1 }, helper: { ...typography.caption, color: colors.danger } });
