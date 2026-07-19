/**
 * Ticket 5 — Client booking schedule (availability-aware)
 *
 * Replaces static date/time chips with availability-derived scheduling:
 *   - Full-width service rows with readable metadata
 *   - 90-day monthly calendar with open / limited / closed / fully-booked states
 *   - Time grid derived from vendor availability model after date selection
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
import { useStripe } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { createBookingFromSelections } from '@/lib/bookings';
import { ensureProfileRow } from '@/lib/auth';
import { addDays, startOfDay, toDateKey } from '@/lib/format';
import { cancelUnpaidBookingAfterPaymentFailure, createBookingPayment } from '@/lib/payments';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getVendorDetail } from '@/lib/vendors';
import { listVehicles } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import {
  deriveAvailableSlots,
  formatTimeDisplay,
  isDateFullyBooked,
  makeEmptyAvailability,
} from '@/store/useVendorAvailabilityStore';
import { Service } from '@/types/domain';

/** Number of future days available to book */
const DATE_WINDOW = 90;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FOOTER_SPACE = 168;

type DateState = {
  value: string;
  day: number;
  label: string;
  monthLabel: string;
  isToday: boolean;
  isInDisplayedMonth: boolean;
  isOutOfWindow: boolean;
  isClosed: boolean;
  isFullyBooked: boolean;
  isLimited: boolean;
  hasSlots: boolean;
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return startOfDay(next);
}

function fromDateIso(dateIso: string) {
  return startOfDay(new Date(`${dateIso}T00:00:00`));
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatWindowDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatFullDate(dateIso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(fromDateIso(dateIso));
}

function getUpcomingDateOptions(): { value: string; label: string; monthLabel: string }[] {
  const today = startOfDay(new Date());
  return Array.from({ length: DATE_WINDOW }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index + 1);
    const iso = toDateKey(date);
    return {
      value: iso,
      label: index === 0 ? 'Tomorrow' : formatFullDate(iso),
      monthLabel: formatMonthYear(date),
    };
  });
}

export default function BookingScheduleScreen() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const insets = useSafeAreaInsets();
  const { draft, clearDraft, updateDraft } = useBookingDraftStore();
  const { session, profile, guestMode, guestClientId, setPostAuthPath } = useAuthStore();
  const [confirming, setConfirming] = useState(false);

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

  // Use server-loaded availability only; an unconfigured vendor yields an empty
  // (no-slot) availability so we show the honest "no availability" state.
  const vendorAvailability = data?.availability ?? makeEmptyAvailability();
  const selectedServiceIds = draft.serviceIds ?? [];
  const selectedServices = services.filter((service) =>
    selectedServiceIds.includes(service.id),
  );
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const serviceFee = Math.round(subtotal * 0.12 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  // In-app payment is only offered when the vendor has active Stripe
  // transfers; otherwise the client pays the vendor directly at the shop.
  const onlinePaymentAvailable = isSupabaseConfigured && vendor?.stripeTransfersStatus === 'active';
  const paymentMethod: 'online' | 'shop' = onlinePaymentAvailable ? draft.paymentMethod ?? 'online' : 'shop';

  const selectedDateForInitialMonth = draft.scheduledDate
    ? fromDateIso(draft.scheduledDate)
    : addDays(startOfDay(new Date()), 1);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfDay(new Date(selectedDateForInitialMonth.getFullYear(), selectedDateForInitialMonth.getMonth(), 1)),
  );

  const savedVehicle = vehicles.find((v) => v.id === draft.vehicleId);
  const hasSelectedVehicle = Boolean(draft.vehicleId);
  const vehicleLabel = savedVehicle
    ? savedVehicle.nickname
      ? `${savedVehicle.nickname} (${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model})`
      : `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}`
    : draft.vehicleId
      ? 'Selected vehicle'
      : null;

  // --- Availability-aware date options ---
  const allDateOptions = useMemo(() => getUpcomingDateOptions(), []);
  const bookingStart = useMemo(() => addDays(startOfDay(new Date()), 1), []);
  const bookingEnd = useMemo(() => addDays(startOfDay(new Date()), DATE_WINDOW), []);
  const bookingWindowLabel = `${formatWindowDate(bookingStart)}-${formatWindowDate(bookingEnd)}`;

  // For each date: derive state from vendor availability
  const dateStates = useMemo(() => {
    return allDateOptions.map((opt) => {
      const fullyBooked = isDateFullyBooked(opt.value, vendorAvailability);
      const slots = deriveAvailableSlots(opt.value, vendorAvailability);
      const maxPossibleSlots = deriveAvailableSlots(opt.value, {
        ...vendorAvailability,
        capacityPerSlot: 999,
      });
      const isClosed = slots.length === 0 && !fullyBooked;
      return {
        ...opt,
        day: fromDateIso(opt.value).getDate(),
        isToday: opt.value === toDateKey(startOfDay(new Date())),
        isInDisplayedMonth: true,
        isOutOfWindow: false,
        isClosed,
        isFullyBooked: fullyBooked,
        isLimited: slots.length > 0 && slots.length <= Math.max(1, Math.floor(maxPossibleSlots.length / 2)),
        hasSlots: slots.length > 0,
      };
    });
  }, [allDateOptions, vendorAvailability]);

  // Next available date (for "next available" CTA)
  const nextAvailableDate = dateStates.find((d) => d.hasSlots);

  const dateStateByValue = useMemo(
    () => new Map(dateStates.map((dateState) => [dateState.value, dateState])),
    [dateStates],
  );

  const calendarDates = useMemo(() => {
    const firstOfMonth = startOfDay(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
    const firstGridDate = addDays(firstOfMonth, -firstOfMonth.getDay());
    return Array.from({ length: 42 }, (_, index): DateState => {
      const cellDate = addDays(firstGridDate, index);
      const value = toDateKey(cellDate);
      const existingState = dateStateByValue.get(value);
      const isOutOfWindow = cellDate < bookingStart || cellDate > bookingEnd;
      if (existingState) {
        return {
          ...existingState,
          isInDisplayedMonth: sameMonth(cellDate, visibleMonth),
          isOutOfWindow,
        };
      }

      return {
        value,
        day: cellDate.getDate(),
        label: formatFullDate(value),
        monthLabel: formatMonthYear(cellDate),
        isToday: value === toDateKey(startOfDay(new Date())),
        isInDisplayedMonth: sameMonth(cellDate, visibleMonth),
        isOutOfWindow: true,
        isClosed: true,
        isFullyBooked: false,
        isLimited: false,
        hasSlots: false,
      };
    });
  }, [bookingEnd, bookingStart, dateStateByValue, visibleMonth]);

  // Available time slots for selected date
  const availableTimeSlots = useMemo(() => {
    if (!draft.scheduledDate) return [];
    return deriveAvailableSlots(draft.scheduledDate, vendorAvailability);
  }, [draft.scheduledDate, vendorAvailability]);

  // Stale slot guard: clear scheduledTime if selected slot no longer exists.
  useEffect(() => {
    if (draft.scheduledTime && !availableTimeSlots.includes(draft.scheduledTime)) {
      updateDraft({ scheduledTime: undefined });
    }
  }, [availableTimeSlots, draft.scheduledTime, updateDraft]);

  // Stale date guard: clear scheduledDate if it is now closed.
  useEffect(() => {
    if (draft.scheduledDate) {
      const dateState = dateStates.find((d) => d.value === draft.scheduledDate);
      if (!dateState || !dateState.hasSlots) {
        updateDraft({ scheduledDate: undefined, scheduledTime: undefined });
      }
    }
  }, [dateStates, draft.scheduledDate, updateDraft]);

  const selectedDateLabel =
    dateStates.find((o) => o.value === draft.scheduledDate)?.label ??
    draft.scheduledDate ??
    'Choose a date';

  const selectedTimeLabel = draft.scheduledTime ? formatTimeDisplay(draft.scheduledTime) : 'Choose a time';
  const previousMonthDisabled = monthKey(visibleMonth) <= monthKey(bookingStart);
  const nextMonthDisabled = monthKey(visibleMonth) >= monthKey(bookingEnd);

  const canConfirm = Boolean(
    draft.vendorId &&
      hasSelectedVehicle &&
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

  const selectDate = (dateState: DateState) => {
    if (!dateState.hasSlots || dateState.isOutOfWindow) return;
    updateDraft({ scheduledDate: dateState.value, scheduledTime: undefined });
  };

  const confirmBooking = async () => {
    if (!canConfirm || confirming) return;

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
    setConfirming(true);

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

      if (isSupabaseConfigured && paymentMethod === 'online') {
        const payment = await createBookingPayment(booking.id);
        // When the vendor hasn't completed payout setup, payment is skipped and
        // the booking proceeds unpaid.
        if (payment.paymentRequired && payment.clientSecret) {
          const initResult = await initPaymentSheet({
            merchantDisplayName: 'AutoServe',
            paymentIntentClientSecret: payment.clientSecret,
            returnURL: 'autoserve://stripe-redirect',
          });

          if (initResult.error) {
            await cancelUnpaidBookingAfterPaymentFailure(booking.id);
            throw new Error(initResult.error.message);
          }

          const paymentResult = await presentPaymentSheet();
          if (paymentResult.error) {
            await cancelUnpaidBookingAfterPaymentFailure(booking.id);
            throw new Error(paymentResult.error.message);
          }
        }
      }

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
    } finally {
      setConfirming(false);
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingBottom: FOOTER_SPACE + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          title="2. Services, date, and time"
          subtitle="Choose the work you need, then lock in a date and one of the vendor's available time slots."
          fallbackHref="/(client)/booking/service"
        />

        <BookingSummaryCard
          title="Booking request"
          rows={[
            { label: 'Vendor', value: vendor?.name ?? (isLoading ? 'Loading...' : 'Selected vendor') },
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
          <SectionHeader
            title="Select services"
            actionLabel={
              selectedServices.length ? `${selectedServices.length} selected` : 'Choose one or more'
            }
          />
          {services.length > 0 ? (
            <View style={styles.serviceList}>
              {services.map((service) => (
                <BookingServiceRow
                  key={service.id}
                  service={service}
                  selected={selectedServiceIds.includes(service.id)}
                  bookingMode={draft.bookingMode}
                  onPress={() => toggleService(service.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noSlotsBox}>
              <Text style={styles.noSlotsTitle}>No services available</Text>
              <Text style={styles.noSlotsBody}>
                This vendor does not have bookable services right now.
              </Text>
              <AppButton
                label="Back to vendor"
                variant="secondary"
                onPress={() => router.back()}
              />
            </View>
          )}
        </View>

        <AppCard style={styles.card}>
          <SectionHeader title="Appointment date" actionLabel={`Book up to ${DATE_WINDOW} days ahead`} />
          <View style={styles.calendarTop}>
            <View style={styles.calendarTitle}>
              <Text style={styles.calendarMonth}>{formatMonthYear(visibleMonth)}</Text>
              <Text style={styles.calendarWindow}>{bookingWindowLabel} booking window</Text>
            </View>
            <View style={styles.calendarControls}>
              <CalendarNavButton
                label="Previous month"
                disabled={previousMonthDisabled}
                direction="previous"
                onPress={() => setVisibleMonth((month) => addMonths(month, -1))}
              />
              <CalendarNavButton
                label="Next month"
                disabled={nextMonthDisabled}
                direction="next"
                onPress={() => setVisibleMonth((month) => addMonths(month, 1))}
              />
            </View>
          </View>

          <View style={styles.calendarGrid}>
            {WEEKDAY_LABELS.map((weekday) => (
              <View key={weekday} style={styles.dateCellWrap}>
                <Text style={styles.weekdayLabel}>{weekday}</Text>
              </View>
            ))}
            {calendarDates.map((dateState) => {
              const active = draft.scheduledDate === dateState.value;
              const disabled = !dateState.hasSlots || dateState.isOutOfWindow;
              const statusLabel = dateState.isOutOfWindow
                ? 'out of booking window'
                : dateState.isFullyBooked
                  ? 'fully booked'
                  : dateState.isClosed
                    ? 'closed'
                    : dateState.isLimited
                      ? 'limited availability'
                      : 'available';

              return (
                <View key={dateState.value} style={styles.dateCellWrap}>
                  <Pressable
                    onPress={() => selectDate(dateState)}
                    disabled={disabled}
                    style={[
                      styles.dateCell,
                      !dateState.isInDisplayedMonth && styles.dateCellOutsideMonth,
                      dateState.hasSlots && styles.dateCellAvailable,
                      dateState.isLimited && !active && styles.dateCellLimited,
                      (dateState.isClosed || dateState.isFullyBooked || dateState.isOutOfWindow) &&
                        styles.dateCellUnavailable,
                      active && styles.dateCellSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled }}
                    accessibilityLabel={`${dateState.label} ${statusLabel}`}
                  >
                    <Text
                      style={[
                        styles.dateCellText,
                        !dateState.isInDisplayedMonth && styles.dateCellTextMuted,
                        (dateState.isClosed || dateState.isFullyBooked || dateState.isOutOfWindow) &&
                          styles.dateCellTextMuted,
                        dateState.isLimited && !active && styles.dateCellTextLimited,
                        active && styles.dateCellTextSelected,
                      ]}
                    >
                      {dateState.day}
                    </Text>
                    {(dateState.isLimited || dateState.isToday) && !active ? (
                      <View style={styles.dateDot} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            <LegendItem label="Open" color={colors.surfaceBrand} />
            <LegendItem label="Limited" color={colors.surfaceAccent} />
            <LegendItem label="Closed/full" color={colors.borderStrong} />
          </View>

          {!nextAvailableDate ? (
            <View style={styles.noSlotsBox}>
              <Text style={styles.noSlotsTitle}>No availability in the next {DATE_WINDOW} days</Text>
              <Text style={styles.noSlotsBody}>
                This vendor has no open slots in the current booking window.
              </Text>
            </View>
          ) : null}
        </AppCard>

        <AppCard style={styles.card}>
          <SectionHeader
            title="Available time slots"
            actionLabel={draft.scheduledDate ? selectedDateLabel : 'Choose a date'}
          />
          {draft.scheduledDate ? (
            availableTimeSlots.length > 0 ? (
              <View style={styles.timeGrid}>
                {availableTimeSlots.map((slot) => {
                  const active = draft.scheduledTime === slot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => updateDraft({ scheduledTime: slot })}
                      style={[styles.timeSlot, active && styles.timeSlotSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={formatTimeDisplay(slot)}
                    >
                      <Text style={[styles.timeSlotText, active && styles.timeSlotTextSelected]}>
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
            )
          ) : (
            <View style={styles.slotPrompt}>
              <Text style={styles.noSlotsTitle}>Choose a date to see available times</Text>
              <Text style={styles.noSlotsBody}>
                Time slots populate after a specific appointment date is selected.
              </Text>
            </View>
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <SectionHeader
            title="Payment"
            actionLabel={paymentMethod === 'online' ? 'Pay online' : 'Pay at shop'}
          />
          {onlinePaymentAvailable ? (
            <View style={styles.paymentOptions}>
              <PaymentOptionRow
                title="Pay online now"
                body="Your card is authorized now and only charged when the vendor accepts the booking."
                selected={paymentMethod === 'online'}
                onPress={() => updateDraft({ paymentMethod: 'online' })}
              />
              <PaymentOptionRow
                title="Pay at the shop"
                body="Pay the vendor directly once the service is done."
                selected={paymentMethod === 'shop'}
                onPress={() => updateDraft({ paymentMethod: 'shop' })}
              />
            </View>
          ) : (
            <Text style={styles.paymentInfoText}>
              This vendor takes payment directly — pay at the shop when the service is done.
            </Text>
          )}
        </AppCard>

        {!canConfirm ? (
          <Text style={styles.validationText}>
            Select at least one service, a date, and a time slot before confirming.
          </Text>
        ) : null}

        {!session && guestMode ? (
          <Text style={styles.validationText}>
            Sign in before confirming so the booking is saved to your account.
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.bookingBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.estimateRow}>
          <View style={styles.estimateBlock}>
            <Text style={styles.estimateLabel}>Total estimate</Text>
            <Text style={styles.estimateValue}>${total.toFixed(2)}</Text>
          </View>
          <View style={[styles.estimateBlock, styles.estimateBlockRight]}>
            <Text style={styles.estimateLabel}>
              {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}
            </Text>
            <Text style={styles.estimateValueSmall}>
              {draft.scheduledTime ? selectedTimeLabel : selectedDateLabel}
            </Text>
          </View>
        </View>
        <AppButton
          label={confirming ? 'Confirming...' : session ? 'Book Appointment' : 'Sign In to Confirm'}
          variant="accent"
          disabled={!canConfirm || confirming}
          onPress={confirmBooking}
        />
      </View>
    </SafeAreaView>
  );
}

function PaymentOptionRow({
  title,
  body,
  selected,
  onPress,
}: {
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.serviceRow, selected && styles.serviceRowSelected, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      <View style={styles.serviceCopy}>
        <Text style={styles.serviceTitle}>{title}</Text>
        <Text style={styles.serviceDescription}>{body}</Text>
      </View>
      <View style={[styles.paymentRadio, selected && styles.paymentRadioSelected]}>
        {selected ? <View style={styles.paymentRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

function BookingServiceRow({
  service,
  selected,
  bookingMode,
  onPress,
}: {
  service: Service;
  selected: boolean;
  bookingMode?: 'shop' | 'mobile';
  onPress: () => void;
}) {
  const modeLabel =
    bookingMode === 'mobile' ? 'Mobile service' : bookingMode === 'shop' ? 'Shop visit' : 'Shop or mobile';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.serviceRow, selected && styles.serviceRowSelected, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${service.title}, $${service.price}, ${service.durationMinutes} minutes`}
    >
      <View style={styles.serviceCopy}>
        <Text style={styles.serviceTitle}>{service.title}</Text>
        {service.description ? (
          <Text style={styles.serviceDescription}>{service.description}</Text>
        ) : null}
        <View style={styles.serviceMeta}>
          <Text style={styles.metaChip}>{modeLabel}</Text>
          <Text style={[styles.metaChip, styles.metaChipSuccess]}>{formatCategory(service.category)}</Text>
        </View>
      </View>
      <View style={styles.priceStack}>
        <Text style={styles.price}>${service.price}</Text>
        <Text style={styles.duration}>{service.durationMinutes} mins</Text>
        <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
          <View style={[styles.checkDotInner, selected && styles.checkDotInnerSelected]} />
        </View>
      </View>
    </Pressable>
  );
}

function CalendarNavButton({
  direction,
  disabled,
  label,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.calendarNav, disabled && styles.calendarNavDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.calendarNavIcon, disabled && styles.calendarNavIconDisabled]}>
        {direction === 'previous' ? '<' : '>'}
      </Text>
    </Pressable>
  );
}

function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function formatCategory(category: string) {
  return category.replace(/^\w/, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.page,
    gap: spacing.xl,
  },
  section: { gap: spacing.md },
  card: { gap: spacing.md },
  serviceList: {
    gap: spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    ...shadows.floating,
  },
  serviceRowSelected: {
    borderColor: 'rgba(15, 76, 129, 0.46)',
    backgroundColor: '#F6FBFF',
  },
  pressed: {
    opacity: 0.92,
  },
  serviceCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  serviceDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  serviceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaChip: {
    ...typography.caption,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    color: colors.textSecondary,
    overflow: 'hidden',
  },
  metaChipSuccess: {
    borderColor: '#BBF7D0',
    backgroundColor: colors.surfaceSubtleGreen,
    color: colors.completed,
  },
  priceStack: {
    minWidth: 74,
    alignItems: 'flex-end',
  },
  price: {
    ...typography.labelLg,
    color: colors.surfaceAccent,
  },
  duration: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  checkDotSelected: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.surfaceBrand,
  },
  checkDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  checkDotInnerSelected: {
    backgroundColor: colors.textInverse,
  },
  calendarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  calendarTitle: {
    flex: 1,
    minWidth: 0,
  },
  calendarMonth: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  calendarWindow: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calendarControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  calendarNav: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavDisabled: {
    backgroundColor: '#F1F5F9',
  },
  calendarNavIcon: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  calendarNavIconDisabled: {
    color: colors.textTertiary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
    rowGap: 6,
  },
  dateCellWrap: {
    width: '14.2857%',
    paddingHorizontal: 3,
  },
  weekdayLabel: {
    ...typography.caption,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  dateCell: {
    minHeight: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  dateCellAvailable: {
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
  },
  dateCellLimited: {
    borderColor: '#FED7AA',
    backgroundColor: colors.surfaceSubtleOrange,
  },
  dateCellUnavailable: {
    backgroundColor: '#F1F5F9',
  },
  dateCellOutsideMonth: {
    opacity: 0.62,
  },
  dateCellSelected: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.surfaceBrand,
  },
  dateCellText: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  dateCellTextMuted: {
    color: colors.textTertiary,
  },
  dateCellTextLimited: {
    color: colors.pending,
  },
  dateCellTextSelected: {
    color: colors.textInverse,
  },
  dateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAccent,
    marginTop: 2,
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    width: '31.5%',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  timeSlotSelected: {
    borderColor: colors.bgStrong,
    backgroundColor: colors.bgStrong,
  },
  timeSlotText: {
    ...typography.labelMd,
    fontSize: 13,
    color: colors.textPrimary,
  },
  timeSlotTextSelected: {
    color: colors.textInverse,
  },
  noSlotsBox: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  slotPrompt: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgBase,
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
  paymentOptions: {
    gap: spacing.sm,
  },
  paymentInfoText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  paymentRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRadioSelected: {
    borderColor: colors.bgStrong,
  },
  paymentRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.bgStrong,
  },
  bookingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadows.card,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  estimateBlock: {
    flex: 1,
    minWidth: 0,
  },
  estimateBlockRight: {
    alignItems: 'flex-end',
  },
  estimateLabel: {
    ...typography.caption,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textSecondary,
  },
  estimateValue: {
    ...typography.titleSm,
    color: colors.textPrimary,
    marginTop: 2,
  },
  estimateValueSmall: {
    ...typography.labelMd,
    color: colors.textPrimary,
    marginTop: 2,
    textAlign: 'right',
  },
});
