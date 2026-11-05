import React from 'react';
import { Text } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState } from '@/components/EmptyState';
import ClientDetails from '@/app/(client)/booking/service';
import GuestDetails from '@/app/(public)/guest-booking/[vendorId]/details';
import { getBookableModes } from '@/lib/booking-types';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { makeDefaultAvailability } from '@/store/useVendorAvailabilityStore';
import { BookingMode, VendorLocationMode } from '@/types/domain';

// Render real forms and interact with their controls; replace network/navigation only.
// jest-expo supplies the renderer version matching React Native.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer');
const { act } = React;
const mockPush = jest.fn();
let mockData: any;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({ vendorId: 'vendor-21' }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: any) => ({
  data: queryKey[0] === 'client-vehicles' ? [{ id: 'vehicle-21', year: '2024', make: 'Honda', model: 'Civic' }]
    : queryKey[0].startsWith('vehicle-') ? [] : mockData,
  isLoading: false,
}) }));
jest.mock('@/lib/vendors', () => ({ getVendorDetail: jest.fn() }));
jest.mock('@/lib/vehicles', () => ({ listVehicles: jest.fn() }));
jest.mock('@/lib/vehicle-catalog', () => ({ listVehicleMakes: jest.fn(), listVehicleModels: jest.fn(), listVehicleYears: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: () => ({ session: { userId: 'client-21' } }) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => children }));
jest.mock('@/components/SearchablePicker', () => ({ SearchablePicker: () => null }));

function configure(locationMode: VendorLocationMode, shop: boolean, mobile: boolean, mode?: BookingMode) {
  const availability = makeDefaultAvailability();
  availability.serviceModeRules.shopVisitsEnabled = shop;
  availability.serviceModeRules.mobileServiceEnabled = mobile;
  const vendor = { id: 'vendor-21', name: 'Test Vendor', locationMode, mobileServiceEnabled: true };
  mockData = { vendor: { ...vendor, bookingModes: getBookableModes(vendor, availability) }, availability, services: [{ id: 'service-21', title: 'Oil change', price: 80, durationMinutes: 30 }] };
  useBookingDraftStore.getState().clearDraft();
  useBookingDraftStore.getState().updateDraft({ vendorId: vendor.id, vehicleId: 'vehicle-21', bookingMode: mode,
    guestName: 'Jordan Lee', guestEmail: 'jordan@example.com', guestPhone: '4165550182',
    vehicleMake: 'Honda', vehicleModel: 'Civic', vehicleYear: '2024', serviceIds: ['service-21'],
  });
}

function textNodes(tree: any): string[] {
  return tree.root.findAllByType(Text).map((node: any) => node.props.children).filter((value: any) => typeof value === 'string');
}

beforeEach(() => mockPush.mockReset());

for (const [name, Screen] of [['client', ClientDetails], ['guest', GuestDetails]] as const) {
  describe(`${name} booking type journey`, () => {
    it.each([
      ['fixed', true, true, ['shop']],
      ['mobile', true, true, ['mobile']],
      ['hybrid', true, true, ['shop', 'mobile']],
      ['hybrid', false, false, []],
    ] as [VendorLocationMode, boolean, boolean, BookingMode[]][])(
      '%s shop=%s mobile=%s renders only %j', (location, shop, mobile, expected) => {
        configure(location, shop, mobile);
        let tree: any;
        act(() => { tree = create(React.createElement(Screen)); });
        const texts = textNodes(tree);
        expect(texts.includes('Shop Visit')).toBe(expected.includes('shop'));
        expect(texts.includes('Mobile Service')).toBe(expected.includes('mobile'));
        if (!expected.length) expect(tree.root.findAllByType(EmptyState).some((node: any) => node.props.title === 'Bookings unavailable')).toBe(true);
        act(() => tree.unmount());
      },
    );

    it.each([['fixed', 'shop'], ['mobile', 'mobile'], ['hybrid', 'shop'], ['hybrid', 'mobile']] as [VendorLocationMode, BookingMode][])(
      'continues with the selected %s %s type', (location, mode) => {
      configure(location, true, true);
      let tree: any;
      act(() => { tree = create(React.createElement(Screen)); });
      const label = mode === 'shop' ? 'Shop Visit' : 'Mobile Service';
      let option = tree.root.findAllByType(Text).find((node: any) => node.props.children === label);
      while (option && !option.props.onPress) option = option.parent;
      act(() => option.props.onPress());
      if (mode === 'mobile') {
        const address = tree.root.findAllByType(AppTextField).find((node: any) => /address/i.test(node.props.label));
        act(() => address.props.onChangeText('123 Main St'));
      }
      const button = tree.root.findAllByType(AppButton).find((node: any) => node.props.label.startsWith('Continue') || node.props.label === 'Review request');
      expect(button.props.disabled).not.toBe(true);
      act(() => button.props.onPress());
      expect(mockPush).toHaveBeenCalled();
      expect(useBookingDraftStore.getState().draft.bookingMode).toBe(mode);
      act(() => tree.unmount());
    });

    it('clears a stale selection and its appointment instead of switching types', () => {
      configure('mobile', true, true, 'shop');
      useBookingDraftStore.getState().updateDraft({ scheduledDate: '2026-12-01', scheduledTime: '09:00' });
      let tree: any;
      act(() => { tree = create(React.createElement(Screen)); });
      expect(useBookingDraftStore.getState().draft.bookingMode).toBeUndefined();
      expect(useBookingDraftStore.getState().draft.scheduledTime).toBeUndefined();
      act(() => tree.unmount());
    });
  });
}
