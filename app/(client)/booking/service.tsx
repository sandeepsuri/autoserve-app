import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { isBookableMode } from '@/lib/booking-types';
import { useBookingBack } from '@/lib/booking-navigation';
import { clampLength } from '@/lib/validation';
import { listVehicles } from '@/lib/vehicles';
import { getVendorDetail } from '@/lib/vendors';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { BookingMode } from '@/types/domain';

const MODE_OPTIONS: { value: BookingMode; label: string; helper: string }[] = [
  {
    value: 'shop',
    label: 'Shop Visit',
    helper: 'Bring your car to the vendor address and check in on arrival.',
  },
  {
    value: 'mobile',
    label: 'Mobile Service',
    helper: 'Have the mechanic come to you when the vendor offers mobile coverage.',
  },
];

export default function BookingDetailsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const { session, guestClientId } = useAuthStore();
  const vehicleOwnerKey = session?.userId ?? guestClientId ?? 'anonymous';

  const handleBack = useBookingBack({
    back: () => router.navigate('/(client)/booking/vehicle'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['booking-vendor-details', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['client-vehicles', vehicleOwnerKey],
    queryFn: listVehicles,
    enabled: Boolean(draft.vehicleId),
  });

  const vendor = data?.vendor;
  const modes = vendor?.bookingModes ?? [];
  const availableModes = MODE_OPTIONS.filter((option) => modes.includes(option.value));
  const selectedMode = isBookableMode(modes, draft.bookingMode) ? draft.bookingMode : undefined;
  useEffect(() => {
    if (!data) return;
    const next = isBookableMode(data.vendor?.bookingModes ?? [], draft.bookingMode) ? draft.bookingMode : undefined;
    if (next !== draft.bookingMode) updateDraft({ bookingMode: next, scheduledDate: undefined, scheduledTime: undefined, mobileAddress: undefined });
  }, [data, draft.bookingMode, updateDraft]);
  const selectedModeMeta = MODE_OPTIONS.find((option) => option.value === selectedMode);

  const savedVehicle = vehicles.find((v) => v.id === draft.vehicleId);
  const hasCurrentOwnerVehicle = Boolean(savedVehicle);
  const vehicleLabel = savedVehicle
    ? savedVehicle.nickname
      ? `${savedVehicle.nickname} (${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model})`
      : `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}`
    : null;

  const canContinue = Boolean(vendor && hasCurrentOwnerVehicle && selectedMode && (selectedMode !== 'mobile' || draft.mobileAddress?.trim()));

  if (!draft.vendorId) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)" />
        <EmptyState
          title="Select a vendor first"
          body="Start from a vendor page so we can carry their services and availability into your booking."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="1. Booking details"
        subtitle="Confirm the vehicle, choose how the service happens, and share any issue details for the mechanic."
        fallbackHref="/(client)/booking/vehicle"
        onBack={handleBack}
      />

      <BookingSummaryCard
        title="Selected vehicle"
        rows={[
          { label: 'Vendor', value: vendor?.name ?? (isLoading ? 'Loading…' : 'Selected vendor') },
          { label: 'Vehicle', value: vehicleLabel ?? 'Complete the vehicle step first' },
        ]}
      />

      <AppCard style={styles.card}>
        <SectionHeader title="Booking type" />
        <View style={styles.optionList}>
          {availableModes.map((option) => {
            const active = selectedMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  updateDraft({
                    bookingMode: option.value,
                    mobileAddress: option.value === 'mobile' ? draft.mobileAddress : undefined,
                    scheduledDate: undefined, scheduledTime: undefined,
                  })
                }
                style={[styles.modeCard, active && styles.modeCardActive]}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeTitle}>{option.label}</Text>
                  <View style={[styles.radio, active && styles.radioActive]} />
                </View>
                <Text style={styles.modeHelper}>{option.helper}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      {selectedMode === 'mobile' ? <AppTextField label="Mobile service address" required maxLength={160} value={draft.mobileAddress ?? ''} onChangeText={(text) => updateDraft({ mobileAddress: clampLength(text.replace(/[<>]/g, ''), 160) })} placeholder="Enter the service address" /> : null}

      <AppCard style={styles.card}>
        <SectionHeader title="Describe the problem" actionLabel="Optional" />
        <AppTextField
          label="Issue details"
          value={draft.notes ?? ''}
          onChangeText={(text) => updateDraft({ notes: clampLength(text.replace(/[<>]/g, ''), 500) })}
          placeholder="Brake squeal at low speed, engine light on, vibration at highway speeds…"
          multiline
          helperText="This note is shared with the vendor before they accept the booking."
          maxLength={500}
        />
      </AppCard>

      <BookingSummaryCard
        title="What happens next"
        rows={[
          { label: 'Step 2', value: 'Pick one or more services' },
          { label: 'Then', value: 'Choose a date and available time slot' },
          { label: 'Booking type', value: selectedModeMeta?.label ?? 'Choose one above' },
        ]}
      />

      {data && !modes.length ? <EmptyState title="Bookings unavailable" body="This vendor is not currently accepting Shop Visits or Mobile Service." /> : null}

      {draft.vehicleId && !hasCurrentOwnerVehicle ? (
        <Text style={styles.infoText}>Choose a vehicle saved to the current account before continuing.</Text>
      ) : null}

      <AppButton
        label="Continue to Service & Time"
        variant="accent"
        disabled={!canContinue}
        onPress={() => router.push('/(client)/booking/schedule')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  optionList: {
    gap: spacing.md,
  },
  modeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  modeCardActive: {
    borderColor: colors.surfaceBrand,
    backgroundColor: '#F6FBFF',
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeTitle: {
    ...typography.titleSm,
    flex: 1,
  },
  modeHelper: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  radioActive: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.surfaceBrand,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
