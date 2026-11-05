import React from 'react';
import { Alert, Text } from 'react-native';

import ClientDetails from '@/app/(client)/booking/service';
import ClientSchedule from '@/app/(client)/booking/schedule';
import GuestDetails from '@/app/(public)/guest-booking/[vendorId]/details';
import GuestReview from '@/app/(public)/guest-booking/[vendorId]/review';
import { AppButton } from '@/components/AppButton';
import { createBookingFromSelections, createGuestBookingFromSelections } from '@/lib/bookings';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { makeDefaultAvailability } from '@/store/useVendorAvailabilityStore';
import { BookingMode, Service } from '@/types/domain';

// jest-expo supplies the renderer version matching React Native.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer');
const { act } = React;

const mockPush = jest.fn();
const mockInvalidate = jest.fn();
let mockData: any;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ vendorId: 'vendor-22' }),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: any) => ({
  data: queryKey[0] === 'client-vehicles' ? [{ id: 'vehicle-22', year: '2024', make: 'Honda', model: 'Civic' }]
    : queryKey[0].startsWith('vehicle-') ? [] : mockData,
  isLoading: false,
}) }));
jest.mock('@stripe/stripe-react-native', () => ({ useStripe: () => ({ initPaymentSheet: jest.fn(), presentPaymentSheet: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'key-22' }));
jest.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: (value: unknown) => mockInvalidate(value) } }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
jest.mock('@/lib/auth', () => ({ ensureProfileRow: jest.fn() }));
jest.mock('@/lib/payments', () => ({ createBookingPayment: jest.fn(), cancelUnpaidBookingAfterPaymentFailure: jest.fn() }));
jest.mock('@/lib/bookings', () => ({ createBookingFromSelections: jest.fn(), createGuestBookingFromSelections: jest.fn() }));
jest.mock('@/lib/vendors', () => ({ getVendorDetail: jest.fn() }));
jest.mock('@/lib/vehicles', () => ({ listVehicles: jest.fn() }));
jest.mock('@/lib/vehicle-catalog', () => ({ listVehicleMakes: jest.fn(), listVehicleModels: jest.fn(), listVehicleYears: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: () => ({ session: { userId: 'client-22' }, setPostAuthPath: jest.fn() }) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => children }));
jest.mock('@/components/SearchablePicker', () => ({ SearchablePicker: () => null }));

const service = (id: string, title: string, bookingEligibility: Service['bookingEligibility']): Service => ({
  id, vendorId: 'vendor-22', title, category: 'oil', price: 50, durationMinutes: 30, active: true, bookingEligibility,
});
const catalogue = [service('oil', 'Oil Change', 'both'), service('align', 'Wheel Alignment', 'shop'), service('tow', 'Roadside Jump', 'mobile')];

// A date the default availability publishes, so the schedule guards keep it.
function firstOpenDate() {
  const { deriveAvailableSlots } = jest.requireActual('@/store/useVendorAvailabilityStore');
  const availability = makeDefaultAvailability();
  for (let offset = 1; offset < 30; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const slots = deriveAvailableSlots(key, availability);
    if (slots.length) return { scheduledDate: key, scheduledTime: slots[0] as string };
  }
  throw new Error('No open date in the default availability');
}

function configure(bookingMode: BookingMode, serviceIds: string[], services = catalogue) {
  mockData = {
    vendor: { id: 'vendor-22', name: 'Test Vendor', address: '1 Main St', bookingModes: ['shop', 'mobile'], mobileServiceEnabled: true, locationMode: 'hybrid' },
    availability: makeDefaultAvailability(),
    services,
  };
  useBookingDraftStore.getState().clearDraft();
  useBookingDraftStore.getState().updateDraft({
    vendorId: 'vendor-22', vehicleId: 'vehicle-22', bookingMode, serviceIds, serviceId: serviceIds[0],
    mobileAddress: bookingMode === 'mobile' ? '1 Main St' : undefined,
    guestName: 'Jordan Lee', guestEmail: 'jordan@example.com', guestPhone: '4165550182',
    vehicleMake: 'Honda', vehicleModel: 'Civic', vehicleYear: '2024',
    ...firstOpenDate(),
  });
}

function render(Screen: React.ComponentType) {
  let tree: any;
  act(() => { tree = create(React.createElement(Screen)); });
  return tree;
}
const draft = () => useBookingDraftStore.getState().draft;
const texts = (tree: any): string[] => tree.root.findAllByType(Text).map((node: any) => node.props.children).filter((value: any) => typeof value === 'string');
function pressableFor(tree: any, title: string) {
  let node = tree.root.findAllByType(Text).find((item: any) => item.props.children === title);
  while (node && !node.props.onPress) node = node.parent;
  return node;
}

beforeEach(() => jest.clearAllMocks());

describe.each([['client', ClientSchedule], ['guest', GuestDetails]] as const)('%s service selection', (_name, Screen) => {
  it('keeps incompatible services visible but disabled, with a reason', () => {
    configure('shop', ['oil']);
    const tree = render(Screen);
    const row = pressableFor(tree, 'Roadside Jump');
    expect(row.props.disabled).toBe(true);
    expect(row.findAllByType(Text).some((node: any) => node.props.children === 'Not available for Shop Visit')).toBe(true);
    expect(pressableFor(tree, 'Wheel Alignment').props.disabled).toBe(false);
    expect(pressableFor(tree, 'Oil Change').props.disabled).toBe(false);
    act(() => tree.unmount());
  });

  it('does not select a disabled service when pressed', () => {
    configure('shop', ['oil']);
    const tree = render(Screen);
    expect(pressableFor(tree, 'Roadside Jump').props.disabled).toBe(true);
    expect(draft().serviceIds).toEqual(['oil']);
    act(() => tree.unmount());
  });

  it('removes a stale incompatible selection on load and says so', () => {
    configure('mobile', ['oil', 'align']);
    const tree = render(Screen);
    expect(draft().serviceIds).toEqual(['oil']);
    expect(draft().serviceId).toBe('oil');
    expect(texts(tree)).toContain('Removed Wheel Alignment: not available for Mobile Service.');
    act(() => tree.unmount());
  });

  it('removes a selection the vendor no longer offers', () => {
    configure('shop', ['oil', 'gone']);
    const tree = render(Screen);
    expect(draft().serviceIds).toEqual(['oil']);
    expect(texts(tree)).toContain('Removed 1 service that is no longer offered.');
    act(() => tree.unmount());
  });
});

describe('changing booking type', () => {
  it('client: step 1 removes incompatible services and names them, and a later change clears the notice', () => {
    configure('shop', ['oil', 'align']);
    const tree = render(ClientDetails);
    expect(draft().serviceIds).toEqual(['oil', 'align']);
    act(() => pressableFor(tree, 'Mobile Service').props.onPress());
    expect(draft().bookingMode).toBe('mobile');
    expect(draft().serviceIds).toEqual(['oil']);
    expect(texts(tree)).toContain('Removed Wheel Alignment: not available for Mobile Service.');
    act(() => pressableFor(tree, 'Shop Visit').props.onPress());
    expect(draft().serviceIds).toEqual(['oil']);
    expect(texts(tree).some((text) => text.startsWith('Removed'))).toBe(false);
    act(() => tree.unmount());
  });

  it('guest: changing type on the form removes incompatible services and names them', () => {
    configure('shop', ['oil', 'align']);
    const tree = render(GuestDetails);
    act(() => pressableFor(tree, 'Mobile Service').props.onPress());
    expect(draft().serviceIds).toEqual(['oil']);
    expect(texts(tree)).toContain('Removed Wheel Alignment: not available for Mobile Service.');
    act(() => tree.unmount());
  });

  it('cannot leave an all-incompatible selection submittable on the client', () => {
    configure('mobile', ['align']);
    const tree = render(ClientSchedule);
    expect(draft().serviceIds).toEqual([]);
    const book = tree.root.findAllByType(AppButton).find((node: any) => node.props.label === 'Review Booking');
    expect(book.props.disabled).toBe(true);
    act(() => tree.unmount());
  });
});

describe('booking steps mounted together', () => {
  it('shows the notice on the visible step when a hidden step reconciles first', () => {
    configure('mobile', ['oil', 'align']);
    const hidden = render(ClientDetails);
    expect(draft().serviceIds).toEqual(['oil']);
    const visible = render(ClientSchedule);
    expect(texts(visible)).toContain('Removed Wheel Alignment: not available for Mobile Service.');
    act(() => visible.unmount());
    act(() => hidden.unmount());
  });

  it('starts a new booking without the previous notice', () => {
    configure('mobile', ['align']);
    const tree = render(ClientDetails);
    expect(draft().serviceRemovalNotice).toBeDefined();
    act(() => useBookingDraftStore.getState().clearDraft());
    expect(draft().serviceRemovalNotice).toBeUndefined();
    act(() => tree.unmount());
  });
});

describe('server rejection', () => {
  const rejection = new Error('Wheel Alignment is not available for Mobile Service. Please review your selected services.');

  it('client: shows the error, keeps the draft, and refetches the vendor', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (createBookingFromSelections as jest.Mock).mockRejectedValue(rejection);
    configure('mobile', ['oil']);
    const tree = render(ClientSchedule);
    const button = (label: string) => tree.root.findAllByType(AppButton).find((node: any) => node.props.label === label);
    expect(button('Review Booking').props.disabled).toBe(false);
    act(() => button('Review Booking').props.onPress());
    await act(async () => { await button('Confirm').props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Booking failed', rejection.message);
    expect(draft().serviceIds).toEqual(['oil']);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['booking-vendor-services', 'vendor-22'] });
    act(() => tree.unmount());
  });

  it('guest: review shows the error, keeps the draft, and refetches the vendor', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (createGuestBookingFromSelections as jest.Mock).mockRejectedValue(rejection);
    configure('mobile', ['oil']);
    useBookingDraftStore.getState().updateDraft({ guestContactConsent: true });
    const tree = render(GuestReview);
    const send = tree.root.findAllByType(AppButton).find((node: any) => node.props.variant === 'accent');
    await act(async () => { await send.props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Could not send request', rejection.message);
    expect(draft().serviceIds).toEqual(['oil']);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['guest-booking-vendor', 'vendor-22'] });
    act(() => tree.unmount());
  });

  it('guest: review drops a service the refetch shows is no longer compatible', () => {
    configure('mobile', ['oil', 'tow']);
    const tree = render(GuestReview);
    expect(draft().serviceIds).toEqual(['oil', 'tow']);
    act(() => tree.unmount());
    mockData = { ...mockData, services: [catalogue[0], service('tow', 'Roadside Jump', 'shop')] };
    const refreshed = render(GuestReview);
    expect(draft().serviceIds).toEqual(['oil']);
    expect(texts(refreshed)).toContain('Removed Roadside Jump: not available for Mobile Service.');
    act(() => refreshed.unmount());
  });
});
