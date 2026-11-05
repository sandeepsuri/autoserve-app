import {
  assertServicesEligible,
  getBookableModes,
  getServiceEligibility,
  ineligibleReason,
  isServiceEligible,
  reconcileNotice,
  reconcileServices,
  serviceEligibilityWarning,
} from '@/lib/booking-types';
import { mapServiceRow } from '@/lib/service-records';
import { makeDefaultAvailability } from '@/store/useVendorAvailabilityStore';
import { Service, ServiceEligibility } from '@/types/domain';

const service = (id: string, bookingEligibility: ServiceEligibility, title = id): Service => ({
  id, vendorId: 'vendor-1', title, category: 'oil', price: 50, durationMinutes: 30, active: true, bookingEligibility,
});

describe('service eligibility contract', () => {
  it.each([
    ['shop', 'shop', true], ['shop', 'mobile', false],
    ['mobile', 'shop', false], ['mobile', 'mobile', true],
    ['both', 'shop', true], ['both', 'mobile', true],
  ] as const)('%s service booked as %s eligible=%s', (eligibility, mode, expected) => {
    expect(isServiceEligible(service('a', eligibility), mode)).toBe(expected);
  });

  it('treats a record saved before the field existed as both', () => {
    const legacy = { title: 'Old' } as Pick<Service, 'title' | 'bookingEligibility'>;
    expect(getServiceEligibility(legacy)).toBe('both');
    expect(isServiceEligible(legacy, 'mobile')).toBe(true);
  });

  it('explains why a service is disabled, and only when it is', () => {
    expect(ineligibleReason(service('a', 'shop'), 'mobile')).toBe('Not available for Mobile Service');
    expect(ineligibleReason(service('a', 'mobile'), 'shop')).toBe('Not available for Shop Visit');
    expect(ineligibleReason(service('a', 'both'), 'shop')).toBeUndefined();
    expect(ineligibleReason(service('a', 'shop'), undefined)).toBeUndefined();
  });

  it('maps a database row, defaulting a missing column', () => {
    const row = { id: 'a', vendor_id: 'v', title: 'T', category: 'oil', duration_minutes: 30, price: 50, active: true };
    expect(mapServiceRow({ ...row, booking_eligibility: 'mobile' }).bookingEligibility).toBe('mobile');
    expect(mapServiceRow(row).bookingEligibility).toBe('both');
  });
});

describe('reconcileServices', () => {
  const catalogue = [service('oil', 'both', 'Oil'), service('align', 'shop', 'Alignment'), service('tow', 'mobile', 'Roadside')];

  it('removes incompatible selections after a booking type change and keeps the rest in order', () => {
    const result = reconcileServices(catalogue, ['align', 'oil'], 'mobile');
    expect(result).toEqual({ serviceIds: ['oil'], removed: ['Alignment'], missingCount: 0 });
    expect(reconcileNotice(result, 'mobile')).toBe('Removed Alignment: not available for Mobile Service.');
  });

  it('removes every selection in a mixed set that no longer fits', () => {
    const result = reconcileServices(catalogue, ['align', 'tow'], 'mobile');
    expect(result.serviceIds).toEqual(['tow']);
    const shop = reconcileServices(catalogue, ['align', 'tow', 'oil'], 'shop');
    expect(shop.serviceIds).toEqual(['align', 'oil']);
    expect(shop.removed).toEqual(['Roadside']);
  });

  it('prunes selections the vendor no longer offers, whatever the booking type', () => {
    const result = reconcileServices(catalogue, ['oil', 'gone'], undefined);
    expect(result).toEqual({ serviceIds: ['oil'], removed: [], missingCount: 1 });
    expect(reconcileNotice(result, undefined)).toBe('Removed 1 service that is no longer offered.');
  });

  it('leaves a valid selection untouched and reports nothing', () => {
    const result = reconcileServices(catalogue, ['oil'], 'shop');
    expect(result.serviceIds).toEqual(['oil']);
    expect(reconcileNotice(result, 'shop')).toBeUndefined();
  });
});

describe('bookable modes with a service catalogue', () => {
  const hybrid = { locationMode: 'hybrid' as const, mobileServiceEnabled: true };
  const availability = makeDefaultAvailability();
  availability.serviceModeRules.shopVisitsEnabled = true;
  availability.serviceModeRules.mobileServiceEnabled = true;

  it('hides a type no active service can be booked under', () => {
    expect(getBookableModes(hybrid, availability, [service('a', 'shop')])).toEqual(['shop']);
    expect(getBookableModes(hybrid, availability, [service('a', 'mobile')])).toEqual(['mobile']);
    expect(getBookableModes(hybrid, availability, [service('a', 'shop'), service('b', 'mobile')])).toEqual(['shop', 'mobile']);
  });

  it('leaves types alone when the vendor has no active services', () => {
    expect(getBookableModes(hybrid, availability, [])).toEqual(['shop', 'mobile']);
  });

  it('never offers a type the vendor location rules out', () => {
    expect(getBookableModes({ locationMode: 'fixed', mobileServiceEnabled: true }, availability, [service('a', 'mobile')])).toEqual([]);
  });
});

describe('assertServicesEligible', () => {
  it('rejects a stale selection with the same wording as the server', () => {
    expect(() => assertServicesEligible([service('a', 'both'), service('b', 'shop', 'Alignment')], 'mobile'))
      .toThrow('Alignment is not available for Mobile Service. Please review your selected services.');
  });

  it('accepts compatible selections', () => {
    expect(() => assertServicesEligible([service('a', 'both'), service('b', 'mobile')], 'mobile')).not.toThrow();
  });
});

describe('serviceEligibilityWarning', () => {
  it('warns when the vendor location can never fulfil the choice', () => {
    expect(serviceEligibilityWarning('mobile', { locationMode: 'fixed', mobileServiceEnabled: false })).toMatch(/can't be booked/);
    expect(serviceEligibilityWarning('shop', { locationMode: 'mobile', mobileServiceEnabled: true })).toMatch(/can't be booked/);
  });

  it('stays quiet when the choice is possible', () => {
    expect(serviceEligibilityWarning('both', { locationMode: 'fixed', mobileServiceEnabled: false })).toBeUndefined();
    expect(serviceEligibilityWarning('shop', { locationMode: 'hybrid', mobileServiceEnabled: true })).toBeUndefined();
    expect(serviceEligibilityWarning('mobile', null)).toBeUndefined();
  });
});
