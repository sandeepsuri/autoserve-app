import { BookingMode, VendorAvailability, VendorLocationMode } from '@/types/domain';

export const BOOKING_TYPE_LABELS: Record<BookingMode, string> = {
  shop: 'Shop Visit',
  mobile: 'Mobile Service',
};

/** Location describes capability; availability switches describe current acceptance. */
export function getBookableModes(
  vendor: { locationMode?: VendorLocationMode; mobileServiceEnabled: boolean },
  availability?: Pick<VendorAvailability, 'serviceModeRules'>,
): BookingMode[] {
  if (!availability) return [];
  const { shopVisitsEnabled, mobileServiceEnabled } = availability.serviceModeRules;
  const location = vendor.locationMode;
  const shop = location !== 'mobile' && shopVisitsEnabled;
  const mobile = (location ? location !== 'fixed' : vendor.mobileServiceEnabled) && mobileServiceEnabled;
  return [...(shop ? ['shop' as const] : []), ...(mobile ? ['mobile' as const] : [])];
}

export function isBookableMode(modes: readonly BookingMode[], mode?: BookingMode): mode is BookingMode {
  return Boolean(mode && modes.includes(mode));
}

/** Keep a valid selection, seed an offered type, or leave an unavailable vendor unselected. */
export function initialBookingMode(modes: readonly BookingMode[], mode?: BookingMode): BookingMode | undefined {
  return isBookableMode(modes, mode) ? mode : modes[0];
}

export function bookingTypesLabel(modes: readonly BookingMode[]): string {
  return modes.map((mode) => BOOKING_TYPE_LABELS[mode]).join(' or ') || 'Bookings unavailable';
}
