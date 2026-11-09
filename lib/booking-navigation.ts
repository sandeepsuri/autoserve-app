import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';

import { useBookingDraftStore } from '@/store/useBookingDraftStore';

const LEAVE_TITLE = 'Leave this booking?';
const LEAVE_MESSAGE = 'Your booking choices will be discarded. Stay to keep them.';

// Booking steps are sibling tab routes, so the tab router's default Back jumps
// to the first tab. Every Back in the flow goes through this module instead.
const CLIENT_BOOKING_ROUTES = new Set([
  'booking/vehicle',
  'booking/service',
  'booking/schedule',
  'booking/review',
]);

export function isClientBookingRoute(routeName: string, params?: object) {
  if (CLIENT_BOOKING_ROUTES.has(routeName)) return true;
  // Adding a vehicle is part of the flow only when it was opened from a booking.
  return routeName === 'vehicle/garage-add' && Boolean((params as { returnTo?: string } | undefined)?.returnTo);
}

export function hasBookingDraft() {
  return Boolean(useBookingDraftStore.getState().draft.vendorId);
}

/**
 * Asks before discarding the draft: Stay changes nothing, Leave clears the draft
 * and then runs `onLeave`. With no draft there is nothing to lose, so `onLeave`
 * runs straight away.
 */
export function promptLeaveBooking(onLeave: () => void) {
  if (!hasBookingDraft()) {
    onLeave();
    return;
  }

  const leave = () => {
    useBookingDraftStore.getState().clearDraft();
    onLeave();
  };

  // Alert.alert is a no-op on react-native-web, which would make Back do nothing.
  if (Platform.OS === 'web') {
    if (window.confirm(`${LEAVE_TITLE}\n\n${LEAVE_MESSAGE}`)) leave();
    return;
  }

  Alert.alert(
    LEAVE_TITLE,
    LEAVE_MESSAGE,
    [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leave },
    ],
    { cancelable: true },
  );
}

interface BookingBackOptions {
  /** Navigates to the logical predecessor of this screen. */
  back: () => void;
  /** True when `back` leaves the booking flow, so it must prompt first. */
  exitsFlow?: boolean;
  enabled?: boolean;
}

/**
 * Applies one Back policy to both controls: hardware Back is handled here while
 * the screen is focused, and the returned handler goes to AppHeader's `onBack`.
 */
export function useBookingBack({ back, exitsFlow = false, enabled = true }: BookingBackOptions) {
  const active = useBookingDraftStore((state) => Boolean(state.draft.vendorId)) && enabled;

  const handleBack = useCallback(() => {
    if (exitsFlow) promptLeaveBooking(back);
    else back();
  }, [back, exitsFlow]);

  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => subscription.remove();
    }, [active, handleBack]),
  );

  return handleBack;
}

/**
 * Hands Back on a root tab to the platform. Without this, Back falls through to
 * the root stack and reveals the Welcome screen, which looks like a sign-out.
 */
export function useExitAppOnBack() {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        BackHandler.exitApp();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );
}
