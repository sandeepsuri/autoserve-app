import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleConfirmScreen() {
  const router = useRouter();
  const { draft } = useBookingDraftStore();

  const saveVehicle = async () => {
    if (!draft.vehicleMake || !draft.vehicleModel || !draft.vehicleYear) {
      router.push('/(public)/premium');
      return;
    }

    router.push('/(client)/booking/service');
  };

  return (
    <Screen>
      <AppHeader title="Confirm your vehicle" subtitle="You can edit these details anytime from your profile later." fallbackHref="/(client)/vehicle/year" />

      <BookingSummaryCard
        title="Selected vehicle"
        rows={[
          { label: 'Make', value: draft.vehicleMake ?? 'Not selected' },
          { label: 'Model', value: draft.vehicleModel ?? 'Not selected' },
          { label: 'Year', value: draft.vehicleYear ?? 'Not selected' },
        ]}
      />

      <AppButton label="Continue to Booking Details" variant="accent" onPress={saveVehicle} />
      <AppButton label="Unlock Auto Vehicle Detection" variant="secondary" onPress={() => router.push('/(public)/premium')} />
    </Screen>
  );
}
