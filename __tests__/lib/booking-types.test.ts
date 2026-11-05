import { bookingTypesLabel, getBookableModes, initialBookingMode, isBookableMode } from '@/lib/booking-types';
import { makeDefaultAvailability } from '@/store/useVendorAvailabilityStore';
import { VendorLocationMode } from '@/types/domain';

describe('bookable booking type contract', () => {
  it.each([
    ['fixed', true, true, ['shop']],
    ['mobile', true, true, ['mobile']],
    ['hybrid', true, true, ['shop', 'mobile']],
    ['hybrid', false, false, []],
    ['hybrid', true, false, ['shop']],
    ['hybrid', false, true, ['mobile']],
    ['fixed', false, true, []],
    ['mobile', true, false, []],
  ] as [VendorLocationMode, boolean, boolean, string[]][])(
    '%s with shop=%s mobile=%s offers %j', (locationMode, shop, mobile, expected) => {
      const availability = makeDefaultAvailability();
      availability.serviceModeRules.shopVisitsEnabled = shop;
      availability.serviceModeRules.mobileServiceEnabled = mobile;
      const modes = getBookableModes({ locationMode, mobileServiceEnabled: true }, availability);
      expect(modes).toEqual(expected);
      for (const mode of ['shop', 'mobile'] as const) expect(isBookableMode(modes, mode)).toBe(expected.includes(mode));
      expect(initialBookingMode(modes)).toBe(expected[0]);
    },
  );

  it('offers nothing before availability loads', () => {
    expect(getBookableModes({ locationMode: 'hybrid', mobileServiceEnabled: true })).toEqual([]);
    expect(initialBookingMode([])).toBeUndefined();
  });

  it('keeps a valid selection and uses stored shop/mobile values', () => {
    expect(initialBookingMode(['shop', 'mobile'], 'mobile')).toBe('mobile');
    expect(isBookableMode(['shop'], 'fixed' as never)).toBe(false);
    expect(bookingTypesLabel(['shop', 'mobile'])).toBe('Shop Visit or Mobile Service');
    expect(bookingTypesLabel([])).toBe('Bookings unavailable');
  });

  it('supports legacy vendors without location mode using the mobile flag', () => {
    expect(getBookableModes({ mobileServiceEnabled: false }, makeDefaultAvailability())).toEqual(['shop']);
    expect(getBookableModes({ mobileServiceEnabled: true }, makeDefaultAvailability())).toEqual(['shop', 'mobile']);
  });
});
