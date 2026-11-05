import React from 'react';
import { BackHandler } from 'react-native';
import VendorBookingDetailScreen from '@/app/(vendor)/booking-detail/[id]';
import { AppHeader } from '@/components/AppHeader';
import VendorLayout from '@/app/(vendor)/_layout';

const { act, create } = jest.requireActual('react-test-renderer');
const { TabRouter, CommonActions } = jest.requireActual('@react-navigation/routers');
const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ id: 'booking-1' }),
    useFocusEffect: (callback: any) => React.useEffect(callback, [callback]),
    Redirect: () => null,
    Tabs: Object.assign((props: any) => React.createElement('tabs', props), { Screen: () => null }),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/lib/vendor-capability', () => ({ loadVendorCapability: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: any) => selector({
    session: { userId: 'owner-1' }, vendorCapability: { hasActiveVendor: true }, setVendorCapability: jest.fn(),
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: true }),
  useQueryClient: () => ({}),
}));
jest.mock('@/lib/bookings', () => ({}));
jest.mock('@/lib/payments', () => ({}));
jest.mock('@/lib/vendor-payouts', () => ({}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false }));

beforeEach(() => jest.clearAllMocks());

test.each(['bookings', 'profile', 'services', 'index'])(
  'vendor detail hardware Back returns to the previous %s screen', async (previous) => {
    let screen: any;
    await act(async () => { screen = create(React.createElement(VendorLayout)); });
    const { backBehavior } = screen.root.findByType('tabs').props;
    const router = TabRouter({ backBehavior, initialRouteName: 'index' });
    const options = {
      routeNames: ['index', 'services', 'bookings', 'location', 'profile', 'booking-detail/[id]'],
      routeParamList: {}, routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    for (const name of ['services', 'profile', previous, 'booking-detail/[id]']) {
      state = router.getStateForAction(state, CommonActions.navigate({ name }), options);
    }
    const back = router.getStateForAction(state, CommonActions.goBack(), options);
    expect(back.routes[back.index].name).toBe(previous);
    await act(async () => { screen.unmount(); });
  },
);

test.each([true, false])('visible Back uses history when available (%s), otherwise vendor fallback', async (hasHistory) => {
  mockRouter.canGoBack.mockReturnValue(hasHistory);
  let screen: any;
  await act(async () => { screen = create(React.createElement(AppHeader, { fallbackHref: '/(vendor)/bookings' })); });
  await act(async () => { screen.root.findAll((node: any) => typeof node.props.onPress === 'function')[0].props.onPress(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(hasHistory ? 1 : 0);
  if (!hasHistory) expect(mockRouter.replace).toHaveBeenCalledWith('/(vendor)/bookings');
  else expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { screen.unmount(); });
});

test.each([true, false])('detail hardware Back has a safe direct-link fallback (history: %s)', async (hasHistory) => {
  mockRouter.canGoBack.mockReturnValue(hasHistory);
  const remove = jest.fn();
  const listener = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  let screen: any;
  await act(async () => { screen = create(React.createElement(VendorBookingDetailScreen)); });
  const callback = listener.mock.calls[0][1];
  expect(callback()).toBe(!hasHistory);
  if (!hasHistory) expect(mockRouter.replace).toHaveBeenCalledWith('/(vendor)/bookings');
  else expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { screen.unmount(); });
  expect(remove).toHaveBeenCalled();
  listener.mockRestore();
});
