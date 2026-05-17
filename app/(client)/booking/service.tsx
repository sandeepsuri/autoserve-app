import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
import { getVendorDetail } from '@/lib/vendors';
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

  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && !draft.bookingMode) {
      seeded.current = true;
      updateDraft({ bookingMode: 'shop' });
    }
  }, [draft.bookingMode, updateDraft]);
  const { data, isLoading } = useQuery({
    queryKey: ['booking-vendor-details', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  const vendor = data?.vendor;
  const availableModes = MODE_OPTIONS.filter((option) => option.value === 'shop' || vendor?.mobileServiceEnabled);
  const selectedMode = draft.bookingMode ?? 'shop';
  const selectedModeMeta = MODE_OPTIONS.find((option) => option.value === selectedMode);
  const vehicleLabel = `${draft.vehicleYear ?? ''} ${draft.vehicleMake ?? ''} ${draft.vehicleModel ?? ''}`.trim();
  const canContinue = Boolean(vendor && vehicleLabel && selectedMode);

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
        fallbackHref="/(client)/vehicle/confirm"
      />

      <BookingSummaryCard
        title="Selected vehicle"
        rows={[
          { label: 'Vendor', value: vendor?.name ?? (isLoading ? 'Loading…' : 'Selected vendor') },
          { label: 'Vehicle', value: vehicleLabel || 'Complete the vehicle step first' },
        ]}
      />

      <AppCard style={styles.card}>
        <SectionHeader title="Service type" />
        <View style={styles.optionList}>
          {availableModes.map((option) => {
            const active = selectedMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  updateDraft({
                    bookingMode: option.value,
                    mobileAddress: option.value === 'mobile' ? draft.mobileAddress ?? 'Current location' : undefined,
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

      <AppCard style={styles.card}>
        <SectionHeader title="Describe the problem" actionLabel="Optional" />
        <AppTextField
          label="Issue details"
          value={draft.notes ?? ''}
          onChangeText={(text) => updateDraft({ notes: text })}
          placeholder="Brake squeal at low speed, engine light on, vibration at highway speeds…"
          multiline
          helperText="This note is shared with the vendor before they accept the booking."
        />
      </AppCard>

      <BookingSummaryCard
        title="What happens next"
        rows={[
          { label: 'Step 2', value: 'Pick one or more services' },
          { label: 'Then', value: 'Choose a date and available time slot' },
          { label: 'Service type', value: selectedModeMeta?.label ?? 'Choose one above' },
        ]}
      />

      {!vendor?.mobileServiceEnabled ? (
        <Text style={styles.infoText}>This vendor is currently accepting shop visits only.</Text>
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
