/**
 * Ticket 5 — Client booking schedule (availability-aware)
 *
 * Replaces static date/time chips with availability-derived states:
 *   - Date chips: open / closed (disabled/hidden) / fully-booked (unavailable)
 *   - Time chips: derived from vendor availability model (slot length + mode)
 *   - No-slots empty state with "next available" CTA
 *   - Stale slot cleared if selected date/time becomes invalid after refresh
 *   - Draft/back behavior preserved
 *
 * Availability is read from useVendorAvailabilityStore (shared model).
 * When a specific vendorId's availability is available in the store it is
 * used; otherwise the default published availability is used as a fallback,
 * mirroring the demo/local data pattern throughout the app.
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
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
import {
  deriveAvailableSlots,
  formatTimeDisplay,
  isDateFullyBooked,
  useVendorAvailabilityStore,
} from '@/store/useVendorAvailabilityStore';

/** Number of future days to show in the date picker */
const DATE_WINDOW = 14;

function getUpcomingDateOptions(): { value: string; label: string }[] {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return Array.from({ length: DATE_WINDOW }, (_, index) => {
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
  const { availability } = useVendorAvailabilityStore();

  const vehicleOwnerKey = session?.userId ?? guestClientId ?? 'anonymous';

  const { data, isLoading } = useQuery({
    queryKey: ['booking-vendor-services', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['client-vehicles', vehicleOwnerKey],
    queryFn: listVehicles,
    enabled: Boolean(draft.vehicleId),
  });

  const vendor = data?.vendor;
  const services = data?.services ?? [];
  // Use server-loaded availability when available; fall back to store (demo/offline)
  const vendorAvailability = data?.availability ?? availability;
  const selectedServiceIds = draft.serviceIds ?? [];
  const selectedServices = services.filter((service) =>
    selectedServiceIds.includes(service.id),
  );
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const serviceFee = Math.round(subtotal * 0.12 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  const savedVehicle = vehicles.find((v) => v.id === draft.vehicleId);
  const vehicleLabel = savedVehicle
    ? savedVehicle.nickname
      ? `${savedVehicle.nickname} (${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model})`
      : `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}`
    : null;

  // --- Availability-aware date options ---
  const allDateOptions = useMemo(() => getUpcomingDateOptions(), []);

  // For each date: derive state from vendor availability
  const dateStates = useMemo(() => {
    return allDateOptions.map((opt) => {
      const fullyBooked = isDateFullyBooked(opt.value, vendorAvailability);
      const slots = deriveAvailableSlots(opt.value, vendorAvailability);
      const isClosed = slots.length === 0 && !fullyBooked;
      return {
        ...opt,
        isClosed,
        isFullyBooked: fullyBooked,
        hasSlots: slots.length > 0,
      };
    });
  }, [allDateOptions, vendorAvailability]);

  // Only open dates shown to client
  const openDates = dateStates.filter((d) => !d.isClosed);

  // Next available date (for "next available" CTA)
  const nextAvailableDate = dateStates.find((d) => d.hasSlots);

  // Available time slots for selected date
  const availableTimeSlots = useMemo(() => {
    if (!draft.scheduledDate) return [];
    return deriveAvailableSlots(draft.scheduledDate, vendorAvailability);
  }, [draft.scheduledDate, vendorAvailability]);

  // Stale slot guard: clear scheduledTime if selected slot no longer exists.
  // updateDraft is stable (zustand setter).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft.scheduledTime && !availableTimeSlots.includes(draft.scheduledTime)) {
      updateDraft({ scheduledTime: undefined });
    }
  }, [availableTimeSlots, draft.scheduledTime]);

  // Stale date guard: clear scheduledDate if it is now closed.
  // updateDraft is stable (zustand setter).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft.scheduledDate) {
      const dateState = dateStates.find((d) => d.value === draft.scheduledDate);
      if (dateState && !dateState.hasSlots) {
        updateDraft({ scheduledDate: undefined, scheduledTime: undefined });
      }
    }
  }, [dateStates, draft.scheduledDate]);

  const selectedDateLabel =
    openDates.find((o) => o.value === draft.scheduledDate)?.label ??
    draft.scheduledDate ??
    'Choose a date';

  const canConfirm = Boolean(
    draft.vendorId &&
      savedVehicle &&
      draft.bookingMode &&
      selectedServiceIds.length &&
      draft.scheduledDate &&
      draft.scheduledTime,
  );

  const toggleService = (serviceId: string) => {
    const next = selectedServiceIds.includes(serviceId)
      ? selectedServiceIds.filter((id) => id !== serviceId)
      : [...selectedServiceIds, serviceId];
    updateDraft({ serviceIds: next, serviceId: next[0] });
  };

  const confirmBooking = async () => {
    if (!canConfirm) return;

    if (!session) {
      setPostAuthPath('/(client)/booking/vehicle');
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
        clientId: session.userId,
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
        subtitle="Choose the work you need, then lock in a date and one of the vendor's available time slots."
        fallbackHref="/(client)/booking/service"
      />

      <BookingSummaryCard
        title="Booking request"
        rows={[
          { label: 'Vendor', value: vendor?.name ?? (isLoading ? 'Loading…' : 'Selected vendor') },
          { label: 'Vehicle', value: vehicleLabel ?? 'Vehicle required' },
          {
            label: 'Service type',
            value: draft.bookingMode === 'mobile' ? 'Mobile Service' : 'Shop Visit',
          },
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

      {/* Availability-aware date picker */}
      <AppCard style={styles.card}>
        <SectionHeader title="Appointment date" />
        {openDates.length > 0 ? (
          <View style={styles.selectionWrap}>
            {openDates.map((opt) => {
              const active = draft.scheduledDate === opt.value;
              const isLimited =
                deriveAvailableSlots(opt.value, vendorAvailability).length <=
                Math.floor(
                  deriveAvailableSlots(opt.value, { ...vendorAvailability, capacityPerSlot: 999 }).length /
                    2,
                );
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => updateDraft({ scheduledDate: opt.value, scheduledTime: undefined })}
                  style={[
                    styles.selectionChip,
                    active && styles.selectionChipActive,
                    isLimited && !active && styles.selectionChipLimited,
                    opt.isFullyBooked && styles.selectionChipBooked,
                  ]}
                  disabled={opt.isFullyBooked}
                  accessibilityState={{ selected: active, disabled: opt.isFullyBooked }}
                  accessibilityLabel={`${opt.label}${opt.isFullyBooked ? ' — fully booked' : isLimited ? ' — limited slots' : ''}`}
                >
                  <Text
                    style={[
                      styles.selectionChipText,
                      active && styles.selectionChipTextActive,
                      opt.isFullyBooked && styles.selectionChipTextBooked,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isLimited && !active ? (
                    <Text style={styles.limitedBadge}>Limited</Text>
                  ) : null}
                  {opt.isFullyBooked ? (
                    <Text style={styles.bookedBadge}>Full</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          /* No-slots empty state */
          <View style={styles.noSlotsBox}>
            <Text style={styles.noSlotsTitle}>No availability in the next {DATE_WINDOW} days</Text>
            <Text style={styles.noSlotsBody}>
              This vendor has no open slots in the next two weeks. Check back later or try another vendor.
            </Text>
            {nextAvailableDate ? (
              <AppButton
                label={`Next available: ${nextAvailableDate.label}`}
                variant="secondary"
                onPress={() =>
                  updateDraft({ scheduledDate: nextAvailableDate.value, scheduledTime: undefined })
                }
              />
            ) : null}
          </View>
        )}
      </AppCard>

      {/* Availability-aware time slot picker */}
      {draft.scheduledDate ? (
        <AppCard style={styles.card}>
          <SectionHeader title="Available time slots" actionLabel={selectedDateLabel} />
          {availableTimeSlots.length > 0 ? (
            <View style={styles.selectionWrap}>
              {availableTimeSlots.map((slot) => {
                const active = draft.scheduledTime === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => updateDraft({ scheduledTime: slot })}
                    style={[
                      styles.selectionChip,
                      styles.timeChip,
                      active && styles.selectionChipActive,
                    ]}
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={formatTimeDisplay(slot)}
                  >
                    <Text
                      style={[
                        styles.selectionChipText,
                        active && styles.selectionChipTextActive,
                      ]}
                    >
                      {formatTimeDisplay(slot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.noSlotsBox}>
              <Text style={styles.noSlotsTitle}>No slots on this date</Text>
              <Text style={styles.noSlotsBody}>
                All slots on {selectedDateLabel} are taken or unavailable. Try another date.
              </Text>
              {nextAvailableDate && nextAvailableDate.value !== draft.scheduledDate ? (
                <AppButton
                  label={`Try ${nextAvailableDate.label}`}
                  variant="secondary"
                  onPress={() =>
                    updateDraft({
                      scheduledDate: nextAvailableDate.value,
                      scheduledTime: undefined,
                    })
                  }
                />
              ) : null}
            </View>
          )}
        </AppCard>
      ) : null}

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
        <Text style={styles.validationText}>
          Select at least one service, a date, and a time slot before confirming.
        </Text>
      ) : null}

      {draft.vehicleId && !savedVehicle ? (
        <Text style={styles.validationText}>
          Choose a vehicle saved to the current account before confirming.
        </Text>
      ) : null}

      {!session && guestMode ? (
        <Text style={styles.validationText}>
          Sign in before confirming so the booking is saved to your account.
        </Text>
      ) : null}

      <AppButton
        label={session ? 'Confirm Booking' : 'Sign In to Confirm'}
        variant="accent"
        disabled={!canConfirm}
        onPress={confirmBooking}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { gap: spacing.md },
  selectionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
    flexDirection: 'row',
    gap: spacing.xs,
  },
  selectionChipActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  selectionChipLimited: {
    borderColor: '#FED7AA',
    backgroundColor: colors.surfaceSubtleOrange,
  },
  selectionChipBooked: {
    opacity: 0.4,
    backgroundColor: colors.bgBase,
  },
  selectionChipText: {
    ...typography.labelMd,
    color: colors.textSecondary,
  },
  selectionChipTextActive: {
    color: colors.textInverse,
  },
  selectionChipTextBooked: {
    color: colors.textTertiary,
  },
  limitedBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 12,
    color: colors.pending,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bookedBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 12,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeChip: { minWidth: 104 },
  noSlotsBox: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  noSlotsTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  noSlotsBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  validationText: {
    ...typography.caption,
    color: colors.pending,
  },
});
