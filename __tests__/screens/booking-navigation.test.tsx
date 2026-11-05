import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, BackHandler, Text } from 'react-native';

import ClientLayout from '@/app/(client)/_layout';
import BookingSchedule from '@/app/(client)/booking/schedule';
import BookingService from '@/app/(client)/booking/service';
import BookingVehicle from '@/app/(client)/booking/vehicle';
import ClientDiscover from '@/app/(client)/index';
import ClientShop from '@/app/(client)/shop/[id]';
import GarageAdd from '@/app/(client)/vehicle/garage-add';
import PublicLayout from '@/app/(public)/_layout';
import GuestDetails from '@/app/(public)/guest-booking/[vendorId]/details';
import GuestReview from '@/app/(public)/guest-booking/[vendorId]/review';
import PublicShop from '@/app/(public)/shop/[id]';
import * as auth from '@/lib/auth';
import { getVendorDetail } from '@/lib/vendors';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { BookingDraft } from '@/types/domain';

// Stands in for the native boundary only. Handlers run newest-first until one
// returns true, like the Android implementation, so the real router's own
// handler is what answers any press the screens do not handle.
jest.mock('react-native/Libraries/Utilities/BackHandler', () => {
  const handlers: (() => boolean)[] = [];
  const BackHandler = {
    addEventListener: (_event: string, handler: () => boolean) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    },
    exitApp: jest.fn(),
    press: () => [...handlers].reverse().some((handler) => handler()),
  };
  return { __esModule: true, default: BackHandler };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));
jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn().mockResolvedValue([]),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
}));
jest.mock('@/components/MapPreview', () => ({ MapPreview: () => null }));
jest.mock('@/lib/vehicles', () => ({
  listVehicles: jest.fn().mockResolvedValue([
    { id: 'car-1', clientId: 'client-1', year: '2020', make: 'Honda', model: 'Civic', isDefault: true },
    { id: 'car-2', clientId: 'client-1', year: '2018', make: 'Ford', model: 'Focus', isDefault: false },
  ]),
  createVehicle: jest.fn(),
}));
jest.mock('@/lib/vehicle-catalog', () => ({
  listVehicleMakes: jest.fn().mockResolvedValue([]),
  listVehicleModels: jest.fn().mockResolvedValue([]),
  listVehicleYears: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/vendors', () => ({
  getVendorDetail: jest.fn(),
  listVendors: jest.fn().mockResolvedValue([]),
}));

// Each journey renders the full flow, including the 90-day schedule calendar.
jest.setTimeout(30000);

const hardwareBack = () => act(() => {
  (BackHandler as unknown as { press: () => boolean }).press();
});

const OPEN_DAY = { bookable: true, openTime: '09:00', closeTime: '11:00' };
const vendorDetail = {
  vendor: {
    id: 'v1', name: 'Test Garage', address: '1 Main St', rating: 5, reviewCount: 1,
    description: 'Great', heroImage: 'hero', mobileServiceEnabled: true,
  },
  services: [
    { id: 's1', vendorId: 'v1', title: 'Oil change', category: 'oil', price: 70, durationMinutes: 30, active: true },
    { id: 's2', vendorId: 'v1', title: 'Tire rotation', category: 'tire', price: 40, durationMinutes: 20, active: true },
  ],
  reviews: [],
  businessHours: [],
  availability: {
    weeklyRules: { 0: OPEN_DAY, 1: OPEN_DAY, 2: OPEN_DAY, 3: OPEN_DAY, 4: OPEN_DAY, 5: OPEN_DAY, 6: OPEN_DAY },
    slotLengthMinutes: 30,
    capacityPerSlot: 1,
    blockedPeriods: [],
    serviceModeRules: { shopVisitsEnabled: true, mobileServiceEnabled: true, sameDayBookingEnabled: false, sameDayLeadHours: 2 },
    quickControls: {},
  },
};

function StubLayout() { return <Stack screenOptions={{ headerShown: false }} />; }

const stub = (name: string) => function Stub() { return <Text>{`stub:${name}`}</Text>; };

function RootLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><Stack screenOptions={{ headerShown: false }} /></QueryClientProvider>;
}

const routes = {
  _layout: RootLayout,
  '(client)/_layout': ClientLayout,
  '(client)/index': ClientDiscover,
  '(client)/bookings': stub('bookings'),
  '(client)/vehicles': stub('vehicles'),
  '(client)/profile': stub('profile'),
  '(client)/shop/[id]': ClientShop,
  '(client)/booking-detail/[id]': stub('booking-detail'),
  '(client)/booking/vehicle': BookingVehicle,
  '(client)/booking/service': BookingService,
  '(client)/booking/schedule': BookingSchedule,
  '(client)/booking/review': stub('review'),
  '(client)/vehicle/make': stub('make'),
  '(client)/vehicle/model': stub('model'),
  '(client)/vehicle/year': stub('year'),
  '(client)/vehicle/confirm': stub('confirm'),
  '(client)/vehicle/garage-add': GarageAdd,
  '(client)/vehicle/garage-edit': stub('garage-edit'),
  '(client)/confirmation': stub('confirmation'),
  '(public)/_layout': PublicLayout,
  '(public)/welcome': stub('welcome'),
  '(public)/discover': stub('public-discover'),
  '(public)/shop/[id]': PublicShop,
  '(public)/guest-booking/[vendorId]/details': GuestDetails,
  '(public)/guest-booking/[vendorId]/review': GuestReview,
  '(auth)/_layout': StubLayout,
  '(auth)/index': stub('auth'),
  '(vendor)/_layout': StubLayout,
  '(vendor)/index': stub('vendor'),
};

// renderRouter adds these to `screen`, but its type does not declare them.
const routerScreen = () => screen as unknown as { getPathname(): string; getSegments(): string[] };
const pathname = () => routerScreen().getPathname();
const segments = () => routerScreen().getSegments();
const draft = () => useBookingDraftStore.getState().draft;
const signIn = () => useAuthStore.setState({
  session: { userId: 'client-1', email: 'c@example.com' },
  profile: { id: 'client-1', email: 'c@example.com', fullName: 'Client', role: 'client' },
  vendorCapability: { hasActiveVendor: false },
  loading: false,
  guestMode: false,
});

// Hidden tab screens stay mounted, so look only at what the user can see.
const press = (text: string) => fireEvent.press(screen.getByText(text));
const pressHeaderBack = () => press('Back');
const goBack = (mechanism: string) => (mechanism === 'hardware' ? hardwareBack() : pressHeaderBack());
// renderRouter turns on fake timers, so waiting means advancing the clock.
const settle = () => act(async () => { await jest.advanceTimersByTimeAsync(50); });

const alertSpy = () => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const lastPrompt = () => (Alert.alert as jest.Mock).mock.calls.at(-1);
const chooseLeave = () => act(() => {
  lastPrompt()[2].find((button: { text: string }) => button.text === 'Leave').onPress();
});

async function openVehicleStep() {
  signIn();
  renderRouter(routes, { initialUrl: '/(client)/shop/v1' });
  await screen.findByText('Book Appointment');
  press('Book Appointment');
  await screen.findByText('Select vehicle');
  await screen.findByText('2018 Ford Focus');
}

/** Walks the real client flow, making every choice the issue names. */
async function completeFlowToSchedule() {
  await openVehicleStep();
  press('2018 Ford Focus');
  press('Continue');
  await screen.findByText('1. Booking details');
  await screen.findByText('Mobile Service');
  press('Mobile Service');
  fireEvent.changeText(screen.getByPlaceholderText(/Brake squeal/), 'Rattling noise');
  press('Continue to Service & Time');
  await screen.findByText('2. Services, date, and time');
  fireEvent.press(await screen.findByLabelText(/^Oil change/));
  fireEvent.press(screen.getByLabelText(/^Tire rotation/));
  fireEvent.press(screen.getAllByLabelText(/ available$/)[0]);
  fireEvent.press(await screen.findByLabelText('9:30 AM'));
}

const expectFullDraft = (snapshot: BookingDraft) => {
  expect(snapshot).toMatchObject({
    vendorId: 'v1',
    vehicleId: 'car-2',
    bookingMode: 'mobile',
    serviceIds: ['s1', 's2'],
    notes: 'Rattling noise',
    scheduledTime: '09:30',
  });
  expect(snapshot.scheduledDate).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
};

beforeEach(() => {
  jest.clearAllMocks();
  (getVendorDetail as jest.Mock).mockResolvedValue(vendorDetail);
  useBookingDraftStore.setState({ draft: {}, submittedGuestBooking: null });
  useAuthStore.setState({
    session: null, profile: null, vendorCapability: null, loading: false, guestMode: false, guestClientId: null,
  });
  alertSpy();
});

afterEach(() => jest.restoreAllMocks());

describe.each(['hardware', 'visible'])('client booking: %s Back', (mechanism) => {
  it('returns exactly one step at a time and keeps every choice', async () => {
    await completeFlowToSchedule();
    const chosen = draft();
    expectFullDraft(chosen);

    goBack(mechanism);
    expect(pathname()).toBe('/booking/service');
    expect(draft()).toEqual(chosen);

    goBack(mechanism);
    expect(pathname()).toBe('/booking/vehicle');
    expect(draft()).toEqual(chosen);
    expect(Alert.alert).not.toHaveBeenCalled();

    // Going forward again shows the same choices rather than re-seeding them.
    press('Continue');
    expect(pathname()).toBe('/booking/service');
    press('Continue to Service & Time');
    expect(pathname()).toBe('/booking/schedule');
    expect(draft()).toEqual(chosen);
  });

  it('prompts on the first step: Stay keeps the flow, Leave exits and clears', async () => {
    await completeFlowToSchedule();
    const chosen = draft();
    goBack(mechanism);
    goBack(mechanism);

    goBack(mechanism);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(lastPrompt()[2].map((button: { text: string }) => button.text)).toEqual(['Stay', 'Leave']);
    // Stay has no action of its own: the alert closes and nothing else happens.
    expect(lastPrompt()[2][0].onPress).toBeUndefined();
    expect(pathname()).toBe('/booking/vehicle');
    expect(draft()).toEqual(chosen);

    chooseLeave();
    expect(pathname()).toBe('/shop/v1');
    await settle();
    expect(draft()).toEqual({});
  });

  it('returns from adding a vehicle to the vehicle step', async () => {
    await openVehicleStep();
    const before = draft();
    press('+ Add new vehicle');
    expect(pathname()).toBe('/vehicle/garage-add');

    goBack(mechanism);
    expect(pathname()).toBe('/booking/vehicle');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(draft()).toEqual(before);
  });
});

describe('client booking: other exits', () => {
  it('prompts on a tab press: Stay keeps the step, Leave goes to that tab', async () => {
    await completeFlowToSchedule();
    const chosen = draft();

    press('Bookings');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(pathname()).toBe('/booking/schedule');
    expect(draft()).toEqual(chosen);

    chooseLeave();
    expect(pathname()).toBe('/bookings');
    await settle();
    expect(draft()).toEqual({});
  });

  it('prompts on a tab press while adding a vehicle for a booking', async () => {
    await openVehicleStep();
    press('+ Add new vehicle');
    press('Profile');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(pathname()).toBe('/vehicle/garage-add');
  });

  it('does not prompt on a tab press outside the flow', async () => {
    signIn();
    useBookingDraftStore.setState({ draft: { vendorId: 'v1' } });
    renderRouter(routes, { initialUrl: '/(client)/bookings' });
    press('Profile');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(pathname()).toBe('/profile');
  });

  it('prompts before "Back to vendor" exits a vendor with no services', async () => {
    (getVendorDetail as jest.Mock).mockResolvedValue({ ...vendorDetail, services: [] });
    signIn();
    useBookingDraftStore.setState({ draft: { vendorId: 'v1', vehicleId: 'car-1', bookingMode: 'shop' } });
    renderRouter(routes, { initialUrl: '/(client)/booking/schedule' });
    await screen.findByText('Back to vendor');
    press('Back to vendor');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(pathname()).toBe('/booking/schedule');

    chooseLeave();
    expect(pathname()).toBe('/shop/v1');
    expect(draft()).toEqual({});
  });

  it('prompts before Book Appointment replaces an unfinished draft', async () => {
    signIn();
    const unfinished = { vendorId: 'other', vehicleId: 'car-1', notes: 'Keep me' };
    useBookingDraftStore.setState({ draft: unfinished });
    renderRouter(routes, { initialUrl: '/(client)/shop/v1' });
    await screen.findByText('Book Appointment');

    press('Book Appointment');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(draft()).toEqual(unfinished);
    expect(pathname()).toBe('/shop/v1');

    chooseLeave();
    expect(pathname()).toBe('/booking/vehicle');
    expect(draft()).toEqual({ vendorId: 'v1', bookingMode: 'shop' });
  });

  it('keeps the chosen date and time while vendor data is still loading', async () => {
    let resolveVendor: (value: unknown) => void = () => undefined;
    (getVendorDetail as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveVendor = resolve; }));
    signIn();
    const date = new Date(Date.now() + 2 * 86_400_000);
    const scheduledDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    useBookingDraftStore.setState({ draft: { vendorId: 'v1', scheduledDate, scheduledTime: '09:30' } });

    renderRouter(routes, { initialUrl: '/(client)/booking/schedule' });
    await settle();
    expect(draft()).toMatchObject({ scheduledDate, scheduledTime: '09:30' });

    await act(async () => { resolveVendor(vendorDetail); });
    await settle();
    expect(draft()).toMatchObject({ scheduledDate, scheduledTime: '09:30' });
  });
});

describe.each(['hardware', 'visible'])('guest booking: %s Back', (mechanism) => {
  const guestDraft = {
    vendorId: 'v1', bookingMode: 'shop' as const, guestName: 'Gia Guest', guestEmail: 'g@example.com', guestPhone: '4165550100',
    vehicleMake: 'Honda', vehicleModel: 'Civic', vehicleYear: '2020', serviceIds: ['s1'], notes: 'Rattling noise',
  };

  async function openDetails() {
    renderRouter(routes, { initialUrl: '/(public)/shop/v1' });
    await screen.findByText('Book Appointment');
    press('Book Appointment');
    await screen.findByText('Guest booking · Step 1 of 2');
    act(() => useBookingDraftStore.getState().updateDraft(guestDraft));
    await settle();
  }

  it('steps from review to details and keeps the draft', async () => {
    await openDetails();
    const chosen = draft();
    press('Review request');
    await screen.findByText('Guest booking · Step 2 of 2');

    goBack(mechanism);
    await screen.findByText('Guest booking · Step 1 of 2');
    expect(pathname()).toBe('/guest-booking/v1/details');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(draft()).toEqual(chosen);
  });

  it('prompts when leaving details: Stay keeps it, Leave returns to the shop and clears', async () => {
    await openDetails();
    const chosen = draft();

    goBack(mechanism);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(pathname()).toBe('/guest-booking/v1/details');
    expect(draft()).toEqual(chosen);

    chooseLeave();
    await waitFor(() => expect(pathname()).toBe('/shop/v1'));
    expect(draft()).toEqual({});
  });
});

describe('client root tab: Android Back', () => {
  it('hands Back to the platform and keeps the session', async () => {
    const signOut = jest.spyOn(auth, 'signOut');
    signIn();
    const session = useAuthStore.getState().session;
    renderRouter(routes, { initialUrl: '/(client)' });
    await settle();

    hardwareBack();

    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(session);
    expect(pathname()).toBe('/');
    expect(segments()).toContain('(client)');
  });

  it('goes from another root tab to Discover without exiting', async () => {
    signIn();
    renderRouter(routes, { initialUrl: '/(client)/bookings' });
    await settle();

    hardwareBack();

    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(segments()).toContain('(client)');
    expect(useAuthStore.getState().session).not.toBeNull();
  });
});
