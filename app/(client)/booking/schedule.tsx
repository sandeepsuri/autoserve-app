import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ServiceCard } from '@/components/ServiceCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { createBookingFromSelections } from '@/lib/bookings';
import { ensureProfileRow } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';
import { getVendorDetail } from '@/lib/vendors';
import { listVehicles } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

const TIME_SLOTS = ['8:30 AM', '10:00 AM', '11:30 AM', '1:30 PM', '3:00 PM', '4:30 PM'] as const;

function getUpcomingDateOptions() {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index + 1);

    const iso = date.toISOString().slice(0, 10);
    const label = index === 0 ? 'Tomorrow' : formatter.format(date);

    return { value: iso, label };
  });
}

export default function BookingScheduleScreen() {
  const router = useRouter();
  const { draft, clearDraft, updateDraft } = useBookingDraftStore();
  const { session, profile, guestMode, guestClientId, setPostAuthPath } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['booking-vendor-services', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['client-vehicles'],
    queryFn: listVehicles,
    enabled: Boolean(draft.vehicleId),
  });

  const vendor = data?.vendor;
  const services = data?.services ?? [];
  const selectedServiceIds = draft.serviceIds ?? [];
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const subtotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const serviceFee = Math.round(subtotal * 0.12 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  const savedVehicle = vehicles.find((v) => v.id === draft.vehicleId);
  const vehicleLabel = savedVehicle
    ? savedVehicle.nickname
      ? `${savedVehicle.nickname} (${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model})`
      : `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}`
    : null;

  const dateOptions = getUpcomingDateOptions();
  const selectedDateLabel = dateOptions.find((option) => option.value === draft.scheduledDate)?.label ?? draft.scheduledDate ?? 'Choose a date';
  const canConfirm = Boolean(
    draft.vendorId &&
      draft.vehicleId &&
      draft.bookingMode &&
      selectedServiceIds.length &&
      draft.scheduledDate &&
      draft.scheduledTime
  );

  const toggleService = (serviceId: string) => {
    const next = selectedServiceIds.includes(serviceId)
      ? selectedServiceIds.filter((id) => id !== serviceId)
      : [...selectedServiceIds, serviceId];

    updateDraft({
      serviceIds: next,
      serviceId: next[0],
    });
  };

  const confirmBooking = async () => {
    if (!canConfirm) {
      return;
    }

    const clientId = session?.userId ?? guestClientId ?? null;

    if (!clientId) {
      setPostAuthPath('/(client)/booking/schedule');
      router.push('/(auth)');
      return;
    }

    if (!vendor || !selectedServices.length) {
      Alert.alert('Vendor data unavailable', 'Please go back and try again.');
      return;
    }

    await ensureProfileRow();

    try {
      const vehicleId = draft.vehicleId;

      if (!vehicleId) {
        Alert.alert('Vehicle required', 'Please go back and select a vehicle before confirming.');
        return;
      }

      const booking = await createBookingFromSelections({
        vendor: { id: vendor.id, name: vendor.name },
        vehicle: { id: vehicleId },
        services: selectedServices,
        scheduledDate: draft.scheduledDate!,
        scheduledTime: draft.scheduledTime!,
        bookingMode: draft.bookingMode!,
        mobileAddress: draft.bookingMode === 'mobile' ? draft.mobileAddress : undefined,
        notes: draft.notes,
        photos: draft.photos,
        clientId,
        clientName: profile?.fullName,
      });

      clearDraft();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['vendor-bookings-status'] }),
      ]);

      router.replace({
        pathname: '/(client)/confirmation',
        params: { bookingId: booking.id },
      });
    } catch (err) {
      Alert.alert('Booking failed', err instanceof Error ? err.message : String(err));
    }
  };

  if (!draft.vendorId) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)" />
        <EmptyState
          title="Select a vendor first"
          body="Start from a vendor page so we can load services and booking availability for the right shop."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="2. Services, date, and time"
        subtitle="Choose the work you need, then lock in a date and one of the vendor’s available time slots."
        fallbackHref="/(client)/booking/service"
      />

      <BookingSummaryCard
        title="Booking request"
        rows={[
          { label: 'Vendor', value: vendor?.name ?? (isLoading ? 'Loading…' : 'Selected vendor') },
          { label: 'Vehicle', value: vehicleLabel ?? 'Vehicle required' },
          { label: 'Service type', value: draft.bookingMode === 'mobile' ? 'Mobile Service' : 'Shop Visit' },
          {
            label: 'Problem',
            value: draft.notes?.trim() ? draft.notes.trim() : 'No issue notes added',
          },
        ]}
      />

      <View style={styles.section}>
        <SectionHeader title="Select services" actionLabel="Choose one or more" />
        <View style={styles.grid}>
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              active={selectedServiceIds.includes(service.id)}
              onPress={() => toggleService(service.id)}
            />
          ))}
        </View>
      </View>

      <AppCard style={styles.card}>
        <SectionHeader title="Appointment date" />
        <View style={styles.selectionWrap}>
          {dateOptions.map((option) => {
            const active = draft.scheduledDate === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => updateDraft({ scheduledDate: option.value })}
                style={[styles.selectionChip, active && styles.selectionChipActive]}
              >
                <Text style={[styles.selectionChipText, active && styles.selectionChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Available time slots" actionLabel={selectedDateLabel} />
        <View style={styles.selectionWrap}>
          {TIME_SLOTS.map((slot) => {
            const active = draft.scheduledTime === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => updateDraft({ scheduledTime: slot })}
                style={[styles.selectionChip, styles.timeChip, active && styles.selectionChipActive]}
              >
                <Text style={[styles.selectionChipText, active && styles.selectionChipTextActive]}>{slot}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <BookingSummaryCard
        title="Total estimate"
        rows={[
          { label: 'Selected services', value: `${selectedServices.length}` },
          { label: 'Subtotal', value: `$${subtotal.toFixed(2)}` },
          { label: 'Service fee', value: `$${serviceFee.toFixed(2)}` },
          { label: 'Estimated total', value: `$${total.toFixed(2)}` },
        ]}
      />

      {!canConfirm ? (
        <Text style={styles.validationText}>Select at least one service, a date, and a time slot before confirming.</Text>
      ) : null}

      <AppButton
        label={session || guestMode ? 'Confirm Booking' : 'Sign In to Confirm'}
        variant="accent"
        disabled={!canConfirm}
        onPress={confirmBooking}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  selectionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectionChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionChipActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  selectionChipText: {
    ...typography.labelMd,
    color: colors.textSecondary,
  },
  selectionChipTextActive: {
    color: colors.textInverse,
  },
  timeChip: {
    minWidth: 104,
  },
  validationText: {
    ...typography.caption,
    color: colors.pending,
  },
});
