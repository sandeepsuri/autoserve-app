import { BookingMode, Service, ServiceEligibility, VendorAvailability, VendorLocationMode } from '@/types/domain';

export const BOOKING_TYPE_LABELS: Record<BookingMode, string> = {
  shop: 'Shop Visit',
  mobile: 'Mobile Service',
};

export const SERVICE_ELIGIBILITY_LABELS: Record<ServiceEligibility, string> = {
  shop: 'Shop only',
  mobile: 'Mobile only',
  both: 'Shop & mobile',
};

type VendorLocation = { locationMode?: VendorLocationMode; mobileServiceEnabled: boolean };

function vendorCanOffer(vendor: VendorLocation, mode: BookingMode): boolean {
  const location = vendor.locationMode;
  if (mode === 'shop') return location !== 'mobile';
  return location ? location !== 'fixed' : vendor.mobileServiceEnabled;
}

/** Records saved before eligibility existed behave as the migration default. */
export function getServiceEligibility(service: Pick<Service, 'bookingEligibility'>): ServiceEligibility {
  return service.bookingEligibility ?? 'both';
}

export function isServiceEligible(service: Pick<Service, 'bookingEligibility'>, mode: BookingMode): boolean {
  const eligibility = getServiceEligibility(service);
  return eligibility === 'both' || eligibility === mode;
}

export function ineligibleReason(service: Pick<Service, 'bookingEligibility'>, mode?: BookingMode): string | undefined {
  return mode && !isServiceEligible(service, mode) ? `Not available for ${BOOKING_TYPE_LABELS[mode]}` : undefined;
}

/**
 * Location describes capability; availability switches describe current acceptance.
 * With a catalogue, a type no active service can be booked under is not offered;
 * a vendor with no active services keeps its types and shows its empty state.
 */
export function getBookableModes(
  vendor: VendorLocation,
  availability?: Pick<VendorAvailability, 'serviceModeRules'>,
  activeServices: readonly Pick<Service, 'bookingEligibility'>[] = [],
): BookingMode[] {
  if (!availability) return [];
  const { shopVisitsEnabled, mobileServiceEnabled } = availability.serviceModeRules;
  const accepted: Record<BookingMode, boolean> = { shop: shopVisitsEnabled, mobile: mobileServiceEnabled };
  return (['shop', 'mobile'] as const).filter((mode) =>
    vendorCanOffer(vendor, mode) && accepted[mode]
    && (!activeServices.length || activeServices.some((service) => isServiceEligible(service, mode))));
}

export interface ServiceReconciliation {
  serviceIds: string[];
  /** Titles of selections the booking type rules out. */
  removed: string[];
  /** Selections no longer in the vendor's active catalogue. */
  missingCount: number;
}

/** Keeps the selections that can still be booked, in their original order. */
export function reconcileServices(
  catalogue: readonly Pick<Service, 'id' | 'title' | 'bookingEligibility'>[],
  selectedIds: readonly string[],
  mode?: BookingMode,
): ServiceReconciliation {
  const result: ServiceReconciliation = { serviceIds: [], removed: [], missingCount: 0 };
  for (const id of selectedIds) {
    const service = catalogue.find((item) => item.id === id);
    if (!service) result.missingCount += 1;
    else if (mode && !isServiceEligible(service, mode)) result.removed.push(service.title);
    else result.serviceIds.push(id);
  }
  return result;
}

export function reconcileNotice(result: ServiceReconciliation, mode?: BookingMode): string | undefined {
  const parts: string[] = [];
  if (result.removed.length && mode) parts.push(`Removed ${result.removed.join(', ')}: not available for ${BOOKING_TYPE_LABELS[mode]}.`);
  if (result.missingCount) parts.push(`Removed ${result.missingCount} ${result.missingCount === 1 ? 'service that is' : 'services that are'} no longer offered.`);
  return parts.join(' ') || undefined;
}

/** Same wording as the server's check, which remains the authority. */
export function assertServicesEligible(services: readonly Pick<Service, 'title' | 'bookingEligibility'>[], mode: BookingMode) {
  const ineligible = services.find((service) => !isServiceEligible(service, mode));
  if (ineligible) throw new Error(`${ineligible.title} is not available for ${BOOKING_TYPE_LABELS[mode]}. Please review your selected services.`);
}

/** Warns a vendor that their location can never fulfil this choice. */
export function serviceEligibilityWarning(eligibility: ServiceEligibility, vendor?: VendorLocation | null): string | undefined {
  if (!vendor || eligibility === 'both' || vendorCanOffer(vendor, eligibility)) return undefined;
  return `Your location settings don't offer ${BOOKING_TYPE_LABELS[eligibility]}, so this service can't be booked until you change one of them.`;
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
