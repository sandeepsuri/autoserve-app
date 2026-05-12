import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { createBooking } from '@/lib/bookings';
import { getVendorDetail } from '@/lib/vendors';
import { createVehicle } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function BookingReviewScreen() {
  const router = useRouter();
  const { draft, clearDraft } = useBookingDraftStore();
  const { session, setPostAuthPath } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['review-vendor', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  const service = data?.services.find((item) => item.id === draft.serviceId);
  const subtotal = service?.price ?? 0;
  const serviceFee = Math.round(subtotal * 0.12 * 100) / 100;
  const total = subtotal + serviceFee;

  const confirmBooking = async () => {
    if (!session) {
      setPostAuthPath('/(client)/booking/review');
      router.push('/(auth)');
      return;
    }

    if (!draft.vendorId || !draft.serviceId || !draft.scheduledDate || !draft.scheduledTime || !draft.bookingMode) {
      Alert.alert('Missing booking details', 'Please finish selecting your service, time, and vehicle.');
      return;
    }

    let vehicleId = draft.vehicleId;
    if (!vehicleId && draft.vehicleMake && draft.vehicleModel && draft.vehicleYear) {
      const vehicle = await createVehicle({
        ownerId: session.userId,
        make: draft.vehicleMake,
        model: draft.vehicleModel,
        year: draft.vehicleYear,
        isDefault: true,
      });
      vehicleId = vehicle.id;
    }

    if (!vehicleId) {
      Alert.alert('Vehicle required', 'Please finish the vehicle selection flow before confirming.');
      return;
    }

    const scheduledAt = `${draft.scheduledDate} ${draft.scheduledTime}`;
    const booking = await createBooking({
      clientId: session.userId,
      vendorId: draft.vendorId,
      serviceId: draft.serviceId,
      vehicleId,
      bookingMode: draft.bookingMode,
      mobileAddress: draft.bookingMode === 'mobile' ? draft.mobileAddress : undefined,
      scheduledAt,
      status: 'pending',
      subtotal,
      serviceFee,
      total,
    });

    clearDraft();
    router.replace({
      pathname: '/(client)/confirmation',
      params: { bookingId: booking.id },
    });
  };

  return (
    <Screen>
      <AppHeader title="3. Review and confirm" subtitle="Final check before we send your request to the vendor." fallbackHref="/(client)/booking/schedule" />

      <BookingSummaryCard
        title="Booking details"
        rows={[
          { label: 'Vendor', value: data?.vendor?.name ?? 'TBD' },
          { label: 'Vehicle', value: `${draft.vehicleYear ?? ''} ${draft.vehicleMake ?? ''} ${draft.vehicleModel ?? ''}`.trim() },
          { label: 'Service', value: service?.title ?? 'Select a service' },
          { label: 'Date & Time', value: `${draft.scheduledDate ?? ''} · ${draft.scheduledTime ?? ''}` },
          { label: 'Location', value: draft.bookingMode === 'mobile' ? draft.mobileAddress ?? 'Mobile service' : data?.vendor?.address ?? 'Shop visit' },
        ]}
      />

      <BookingSummaryCard
        title="Price breakdown"
        rows={[
          { label: 'Service subtotal', value: `$${subtotal.toFixed(2)}` },
          { label: 'Service fee', value: `$${serviceFee.toFixed(2)}` },
          { label: 'Total paid', value: `$${total.toFixed(2)}` },
        ]}
      />

      <AppButton label={session ? 'Confirm Booking' : 'Sign In to Confirm'} variant="accent" onPress={confirmBooking} />
    </Screen>
  );
}
