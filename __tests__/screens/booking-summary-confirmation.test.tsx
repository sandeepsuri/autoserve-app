import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Modal, Text } from 'react-native';

import ClientLayout from '@/app/(client)/_layout';
import BookingSchedule from '@/app/(client)/booking/schedule';
import BookingService from '@/app/(client)/booking/service';
import BookingVehicle from '@/app/(client)/booking/vehicle';
import Confirmation from '@/app/(client)/confirmation';
import ClientShop from '@/app/(client)/shop/[id]';
import PublicLayout from '@/app/(public)/_layout';
import GuestReview from '@/app/(public)/guest-booking/[vendorId]/review';
import { ensureProfileRow } from '@/lib/auth';
import { createBookingFromSelections, createGuestBookingFromSelections, getBookingById } from '@/lib/bookings';
import { cancelUnpaidBookingAfterPaymentFailure, createBookingPayment } from '@/lib/payments';
import { queryClient } from '@/lib/query-client';
import { getVendorDetail } from '@/lib/vendors';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

let mockSupabaseConfigured = false;
const mockInitPaymentSheet = jest.fn();
const mockPresentPaymentSheet = jest.fn();

jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({ initPaymentSheet: mockInitPaymentSheet, presentPaymentSheet: mockPresentPaymentSheet }),
}));
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockSupabaseConfigured; },
  supabase: null,
}));
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), ensureProfileRow: jest.fn() }));
jest.mock('@/lib/bookings', () => ({
  ...jest.requireActual('@/lib/bookings'),
  createBookingFromSelections: jest.fn(),
  createGuestBookingFromSelections: jest.fn(),
  getBookingById: jest.fn(),
}));
jest.mock('@/lib/payments', () => ({
  createBookingPayment: jest.fn(),
  cancelUnpaidBookingAfterPaymentFailure: jest.fn(),
}));
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
    { id: 'car-1', ownerId: 'client-1', year: '2020', make: 'Honda', model: 'Civic', isDefault: true },
    { id: 'car-2', ownerId: 'client-1', year: '2018', make: 'Ford', model: 'Focus', isDefault: false },
  ]),
}));
jest.mock('@/lib/vendors', () => ({
  getVendorDetail: jest.fn(),
  listVendors: jest.fn().mockResolvedValue([]),
}));

// Each journey renders the full flow, including the 90-day schedule calendar.
jest.setTimeout(30000);

const OPEN_DAY = { bookable: true, openTime: '09:00', closeTime: '11:00' };
const vendorDetail = {
  vendor: {
    id: 'v1', name: 'Test Garage', address: '1 Main St', rating: 5, reviewCount: 1,
    description: 'Great', heroImage: 'hero', mobileServiceEnabled: true, bookingModes: ['shop', 'mobile'],
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
const onlineVendorDetail = { ...vendorDetail, vendor: { ...vendorDetail.vendor, stripeTransfersStatus: 'active' } };
const receipt = {
  id: 'booking-1', vendorName: 'Test Garage', bookingMode: 'mobile', status: 'pending', total: 123.2,
  services: [{ title: 'Oil change' }, { title: 'Tire rotation' }],
  appointmentDate: '2030-01-01', appointmentTime: '09:30',
};

const stub = (name: string) => function Stub() { return <Text>{`stub:${name}`}</Text>; };
function StubLayout() { return <Stack screenOptions={{ headerShown: false }} />; }
function RootLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><Stack screenOptions={{ headerShown: false }} /></QueryClientProvider>;
}

const routes = {
  _layout: RootLayout,
  '(client)/_layout': ClientLayout,
  '(client)/index': stub('discover'),
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
  '(client)/vehicle/garage-add': stub('garage-add'),
  '(client)/vehicle/garage-edit': stub('garage-edit'),
  '(client)/confirmation': Confirmation,
  '(public)/_layout': PublicLayout,
  '(public)/welcome': stub('welcome'),
  '(public)/discover': stub('public-discover'),
  '(public)/shop/[id]': stub('public-shop'),
  '(public)/guest-booking/[vendorId]/details': stub('guest-details'),
  '(public)/guest-booking/[vendorId]/review': GuestReview,
  '(public)/guest-booking/[vendorId]/confirmation': stub('guest-confirmation'),
  '(auth)/_layout': StubLayout,
  '(auth)/index': stub('auth'),
  '(vendor)/_layout': StubLayout,
  '(vendor)/index': stub('vendor'),
};

const pathname = () => (screen as unknown as { getPathname(): string }).getPathname();
const draft = () => useBookingDraftStore.getState().draft;
const press = (text: string) => fireEvent.press(screen.getByText(text));
const settle = () => act(async () => { await jest.advanceTimersByTimeAsync(50); });
const modalOpen = () => screen.queryByText('Confirm your booking') !== null;
// The vendor page's closed services sheet is also a Modal, and stays mounted.
const confirmationModal = () => screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!;
const inModal = () => within(confirmationModal());
// accessibilityViewIsModal hides the scrim from screen readers, and so from default queries.
const pressScrim = () => fireEvent.press(screen.getByLabelText('Close confirmation', { includeHiddenElements: true }));

const signIn = () => useAuthStore.setState({
  session: { userId: 'client-1', email: 'c@example.com' },
  profile: { id: 'client-1', email: 'c@example.com', fullName: 'Client', role: 'client' },
  vendorCapability: { hasActiveVendor: false },
  loading: false,
  guestMode: false,
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

/** Walks the real client flow from the vendor page to a complete schedule step. */
async function bookFromVendorPage(services: string[], mode: 'Shop Visit' | 'Mobile Service' = 'Mobile Service') {
  signIn();
  renderRouter(routes, { initialUrl: '/(client)/shop/v1' });
  await screen.findByText('Book Appointment');
  press('Book Appointment');
  await screen.findByText('Select vehicle');
  await screen.findByText('2018 Ford Focus');
  press('2018 Ford Focus');
  press('Continue');
  await screen.findByText('1. Booking details');
  await settle();
  // Shop Visit is already selected by the vendor page.
  if (mode === 'Mobile Service') {
    press(mode);
    fireEvent.changeText(screen.getByPlaceholderText('Enter the service address'), '123 Side St');
  }
  press('Continue to Service & Time');
  await screen.findByText('2. Services, date, and time');
  await screen.findByLabelText(new RegExp(`^${services[0]}`));
  services.forEach((title) => fireEvent.press(screen.getByLabelText(new RegExp(`^${title}`))));
  fireEvent.press(screen.getAllByLabelText(/ available$/)[0]);
  fireEvent.press(await screen.findByLabelText('9:30 AM'));
  await settle();
}

async function openReview(services = ['Oil change', 'Tire rotation']) {
  await bookFromVendorPage(services);
  press('Review Booking');
  expect(modalOpen()).toBe(true);
}

const expectNoBookingOrPayment = () => {
  expect(createBookingFromSelections).not.toHaveBeenCalled();
  expect(createBookingPayment).not.toHaveBeenCalled();
  expect(mockInitPaymentSheet).not.toHaveBeenCalled();
  expect(mockPresentPaymentSheet).not.toHaveBeenCalled();
};

const confirmAndSettle = async () => {
  press('Confirm');
  await settle();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseConfigured = false;
  (getVendorDetail as jest.Mock).mockResolvedValue(vendorDetail);
  (ensureProfileRow as jest.Mock).mockResolvedValue(undefined);
  (createBookingFromSelections as jest.Mock).mockResolvedValue({ id: 'booking-1' });
  (getBookingById as jest.Mock).mockResolvedValue(receipt);
  mockInitPaymentSheet.mockResolvedValue({});
  mockPresentPaymentSheet.mockResolvedValue({});
  useBookingDraftStore.setState({ draft: {}, submittedGuestBooking: null });
  useAuthStore.setState({
    session: null, profile: null, vendorCapability: null, loading: false, guestMode: false, guestClientId: null,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('selection summary on booking steps', () => {
  it('shows the vehicle, count, names, duration, and price on every step', async () => {
    await bookFromVendorPage(['Oil change', 'Tire rotation']);

    const expectSummary = () => {
      expect(screen.getByText('2018 Ford Focus')).toBeTruthy();
      expect(screen.getByText('2 selected: Oil change, Tire rotation')).toBeTruthy();
      expect(screen.getByText('50 min')).toBeTruthy();
      expect(screen.getAllByText('$123.20').length).toBeGreaterThan(0);
    };

    expectSummary();
    press('Back');
    expect(pathname()).toBe('/booking/service');
    expectSummary();
    press('Back');
    expect(pathname()).toBe('/booking/vehicle');
    // The vehicle also appears in its own picker row on this step.
    expect(screen.getAllByText('2018 Ford Focus')).toHaveLength(2);
    expect(screen.getByText('2 selected: Oil change, Tire rotation')).toBeTruthy();
    expect(screen.getByText('50 min')).toBeTruthy();
    expect(screen.getByText('$123.20')).toBeTruthy();
  });

  it('follows the highlighted vehicle on the vehicle step', async () => {
    signIn();
    useBookingDraftStore.setState({ draft: { vendorId: 'v1', bookingMode: 'shop' } });
    renderRouter(routes, { initialUrl: '/(client)/booking/vehicle' });
    await screen.findByText('2018 Ford Focus');
    await settle();
    expect(screen.getAllByText('2020 Honda Civic')).toHaveLength(2);
    expect(await screen.findByText('None selected yet')).toBeTruthy();

    press('2018 Ford Focus');
    expect(screen.getAllByText('2018 Ford Focus')).toHaveLength(2);
    expect(screen.getAllByText('2020 Honda Civic')).toHaveLength(1);
  });

  it('updates as services change', async () => {
    await bookFromVendorPage(['Oil change']);
    expect(screen.getByText('1 selected: Oil change')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/^Oil change/));
    expect(screen.getByText('None selected yet')).toBeTruthy();
    expect(screen.queryByText('30 min')).toBeNull();
  });
});

describe('journey from vendor detail to receipt', () => {
  it('books one service', async () => {
    await openReview(['Oil change']);
    const modal = inModal();
    expect(modal.getByText('1 service')).toBeTruthy();
    expect(modal.getByText('Oil change · 30 min')).toBeTruthy();
    // The service price and the subtotal.
    expect(modal.getAllByText('$70.00')).toHaveLength(2);
    expect(modal.getByText('$8.40')).toBeTruthy();
    expect(modal.getByText('$78.40')).toBeTruthy();

    await confirmAndSettle();

    expect(createBookingFromSelections).toHaveBeenCalledTimes(1);
    expect((createBookingFromSelections as jest.Mock).mock.calls[0][0].services.map((s: { id: string }) => s.id)).toEqual(['s1']);
    expect(pathname()).toBe('/confirmation');
    expect(await screen.findByText('Booking confirmed')).toBeTruthy();
    expect(draft()).toEqual({});
  });

  it('books several services and shows every appointment detail first', async () => {
    await openReview();
    const { scheduledDate } = draft();
    const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      .format(new Date(`${scheduledDate}T00:00:00`));

    const modal = inModal();
    ['Test Garage', '2018 Ford Focus', 'Mobile Service', dateLabel, '9:30 AM', '123 Side St', 'Pay at the shop'].forEach((value) => {
      expect(modal.getByText(value)).toBeTruthy();
    });
    expect(modal.getByText('2 services')).toBeTruthy();
    expect(modal.getByText('Oil change · 30 min')).toBeTruthy();
    expect(modal.getByText('$70.00')).toBeTruthy();
    expect(modal.getByText('Tire rotation · 20 min')).toBeTruthy();
    expect(modal.getByText('$40.00')).toBeTruthy();
    expect(modal.getByText('$110.00')).toBeTruthy();
    expect(modal.getByText('$13.20')).toBeTruthy();
    expect(modal.getByText('$123.20')).toBeTruthy();
    // Showing the modal has no side effects.
    expectNoBookingOrPayment();

    await confirmAndSettle();

    const submitted = (createBookingFromSelections as jest.Mock).mock.calls[0][0];
    expect(submitted).toMatchObject({
      vendor: { id: 'v1' }, vehicle: { id: 'car-2' }, bookingMode: 'mobile', mobileAddress: '123 Side St',
      scheduledDate, scheduledTime: '09:30', clientId: 'client-1',
    });
    expect(submitted.services.map((s: { id: string }) => s.id)).toEqual(['s1', 's2']);
    expect(pathname()).toBe('/confirmation');
    expect(await screen.findByText('Booking confirmed')).toBeTruthy();
    expect(modalOpen()).toBe(false);
    expect(draft()).toEqual({});
  });

  it('uses the shop address as the location for a Shop Visit', async () => {
    await bookFromVendorPage(['Oil change'], 'Shop Visit');
    press('Review Booking');
    const modal = inModal();
    expect(modal.getByText('Shop Visit')).toBeTruthy();
    expect(modal.getByText('1 Main St')).toBeTruthy();
  });

  it('reaches the receipt without waiting for booking lists to refresh', async () => {
    jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(new Promise(() => undefined));
    await openReview();
    await confirmAndSettle();
    expect(pathname()).toBe('/confirmation');
    expect(draft()).toEqual({});
  });

  it('sends a signed-out client to sign in without opening the modal', async () => {
    useAuthStore.setState({ guestMode: true, guestClientId: 'guest-1' });
    useBookingDraftStore.setState({
      draft: {
        vendorId: 'v1', vehicleId: 'car-1', bookingMode: 'shop', serviceIds: ['s1'], serviceId: 's1',
      },
    });
    renderRouter(routes, { initialUrl: '/(client)/booking/schedule' });
    await screen.findByText('Sign In to Confirm');
    await settle();
    fireEvent.press(screen.getAllByLabelText(/ available$/)[0]);
    fireEvent.press(await screen.findByLabelText('9:30 AM'));
    await settle();
    const chosen = draft();

    press('Sign In to Confirm');

    expect(modalOpen()).toBe(false);
    expect(useAuthStore.getState().postAuthPath).toBe('/(client)/booking/vehicle');
    expect(draft()).toEqual(chosen);
    expectNoBookingOrPayment();
  });
});

describe('cancelling the confirmation', () => {
  const closes: [string, () => void][] = [
    ['Cancel', () => press('Cancel')],
    ['the scrim', pressScrim],
    ['Android Back', () => act(() => confirmationModal().props.onRequestClose())],
  ];

  it.each(closes)('%s keeps the draft and creates nothing', async (_name, close) => {
    await openReview();
    const chosen = draft();

    close();

    expect(modalOpen()).toBe(false);
    expect(pathname()).toBe('/booking/schedule');
    expect(draft()).toEqual(chosen);
    await settle();
    expectNoBookingOrPayment();
    expect(ensureProfileRow).not.toHaveBeenCalled();
  });

  it('lets the client edit and review the change', async () => {
    await openReview();
    press('Cancel');
    fireEvent.press(screen.getByLabelText(/^Tire rotation/));
    press('Review Booking');
    expect(inModal().getByText('1 service')).toBeTruthy();
    expect(inModal().queryByText('Tire rotation · 20 min')).toBeNull();
  });

  it('closes when the appointment stops being valid', async () => {
    await openReview();
    act(() => useBookingDraftStore.getState().updateDraft({ scheduledTime: undefined }));
    await settle();
    expect(modalOpen()).toBe(false);
  });
});

describe('repeated Confirm', () => {
  it('submits once when tapped twice before a re-render', async () => {
    await openReview();
    const confirm = screen.getByText('Confirm');
    act(() => {
      fireEvent.press(confirm);
      fireEvent.press(confirm);
    });
    await settle();
    expect(createBookingFromSelections).toHaveBeenCalledTimes(1);
  });

  it('submits once when tapped again while the profile is being saved', async () => {
    const profile = deferred<void>();
    (ensureProfileRow as jest.Mock).mockReturnValue(profile.promise);
    await openReview();
    const confirm = screen.getByText('Confirm');
    fireEvent.press(confirm);
    fireEvent.press(confirm);

    await act(async () => { profile.resolve(); await jest.advanceTimersByTimeAsync(50); });

    expect(ensureProfileRow).toHaveBeenCalledTimes(1);
    expect(createBookingFromSelections).toHaveBeenCalledTimes(1);
  });

  it('shows progress and blocks every way out while submitting', async () => {
    const pending = deferred<{ id: string }>();
    (createBookingFromSelections as jest.Mock).mockReturnValue(pending.promise);
    await openReview();
    const chosen = draft();

    await confirmAndSettle();

    expect(screen.getByText('Submitting your booking…')).toBeTruthy();
    expect(screen.getByText('Confirming…')).toBeTruthy();
    press('Cancel');
    pressScrim();
    act(() => confirmationModal().props.onRequestClose());
    expect(modalOpen()).toBe(true);
    expect(draft()).toEqual(chosen);

    await act(async () => { pending.resolve({ id: 'booking-1' }); await jest.advanceTimersByTimeAsync(50); });
    expect(pathname()).toBe('/confirmation');
  });
});

describe('failed submission', () => {
  it('keeps the draft and the modal, then succeeds on retry', async () => {
    (createBookingFromSelections as jest.Mock).mockRejectedValueOnce(new Error('Slot taken'));
    await openReview();
    const chosen = draft();

    await confirmAndSettle();

    expect(Alert.alert).toHaveBeenCalledWith('Booking failed', 'Slot taken');
    expect(createBookingPayment).not.toHaveBeenCalled();
    expect(pathname()).toBe('/booking/schedule');
    expect(draft()).toEqual(chosen);
    expect(modalOpen()).toBe(true);

    await confirmAndSettle();

    expect(createBookingFromSelections).toHaveBeenCalledTimes(2);
    expect(pathname()).toBe('/confirmation');
    expect(draft()).toEqual({});
  });

  it('reports a profile failure instead of swallowing it', async () => {
    (ensureProfileRow as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await openReview();
    const chosen = draft();

    await confirmAndSettle();

    expect(Alert.alert).toHaveBeenCalledWith('Booking failed', 'Offline');
    expect(createBookingFromSelections).not.toHaveBeenCalled();
    expect(draft()).toEqual(chosen);
  });
});

describe('online payment', () => {
  const openOnlineReview = async () => {
    mockSupabaseConfigured = true;
    (getVendorDetail as jest.Mock).mockResolvedValue(onlineVendorDetail);
    (createBookingPayment as jest.Mock).mockResolvedValue({ paymentRequired: true, clientSecret: 'secret', paymentIntentId: 'pi' });
    await openReview();
    expect(inModal().getByText('Pay online now')).toBeTruthy();
    expectNoBookingOrPayment();
  };

  it('takes payment after Confirm and reaches the receipt', async () => {
    await openOnlineReview();
    await confirmAndSettle();

    expect(createBookingPayment).toHaveBeenCalledWith('booking-1');
    expect(mockPresentPaymentSheet).toHaveBeenCalledTimes(1);
    expect(cancelUnpaidBookingAfterPaymentFailure).not.toHaveBeenCalled();
    expect(pathname()).toBe('/confirmation');
    expect(draft()).toEqual({});
  });

  it('proceeds unpaid when no payment is required', async () => {
    await openOnlineReview();
    (createBookingPayment as jest.Mock).mockResolvedValue({ paymentRequired: false });
    await confirmAndSettle();

    expect(mockPresentPaymentSheet).not.toHaveBeenCalled();
    expect(pathname()).toBe('/confirmation');
  });

  const failures: [string, () => void, string][] = [
    ['payment setup', () => (createBookingPayment as jest.Mock).mockRejectedValue(new Error('Setup failed')), 'Setup failed'],
    ['the payment sheet setup', () => mockInitPaymentSheet.mockResolvedValue({ error: { message: 'Init failed' } }), 'Init failed'],
    ['the payment sheet', () => mockPresentPaymentSheet.mockResolvedValue({ error: { message: 'Canceled' } }), 'Canceled'],
  ];

  it.each(failures)('cancels the booking and keeps the draft when %s fails', async (_name, arrange, message) => {
    await openOnlineReview();
    arrange();
    const chosen = draft();

    await confirmAndSettle();

    expect(cancelUnpaidBookingAfterPaymentFailure).toHaveBeenCalledTimes(1);
    expect(cancelUnpaidBookingAfterPaymentFailure).toHaveBeenCalledWith('booking-1');
    expect(Alert.alert).toHaveBeenCalledWith('Booking failed', message);
    expect(pathname()).toBe('/booking/schedule');
    expect(draft()).toEqual(chosen);
    expect(modalOpen()).toBe(true);
  });

  it('tells the client when the automatic cancel also fails', async () => {
    await openOnlineReview();
    (createBookingPayment as jest.Mock).mockRejectedValue(new Error('Setup failed'));
    (cancelUnpaidBookingAfterPaymentFailure as jest.Mock).mockRejectedValueOnce(new Error('Could not be cancelled automatically'));
    const chosen = draft();

    await confirmAndSettle();

    expect(Alert.alert).toHaveBeenCalledWith('Booking failed', 'Could not be cancelled automatically');
    expect(draft()).toEqual(chosen);
  });
});

describe('guest review', () => {
  const guestDraft = {
    vendorId: 'v1', bookingMode: 'mobile' as const, mobileAddress: '123 Side St', guestContactConsent: true,
    guestName: 'Gia Guest', guestEmail: 'g@example.com', guestPhone: '4165550100',
    vehicleMake: 'Honda', vehicleModel: 'Civic', vehicleYear: '2020', serviceIds: ['s1', 's2'],
    scheduledDate: '2030-01-01', scheduledTime: '09:30',
  };

  const openGuestReview = async () => {
    useBookingDraftStore.setState({ draft: guestDraft });
    renderRouter(routes, { initialUrl: '/(public)/guest-booking/v1/review' });
    await screen.findByText('Guest booking · Step 2 of 2');
  };

  it('shows each service price, total duration, location, and total', async () => {
    await openGuestReview();
    expect(screen.getByText('Oil change · $70.00\nTire rotation · $40.00')).toBeTruthy();
    expect(screen.getByText('50 min')).toBeTruthy();
    expect(screen.getByText('123 Side St')).toBeTruthy();
    expect(screen.getByText('$123.20')).toBeTruthy();
  });

  it('sends one request when tapped twice before a re-render', async () => {
    (createGuestBookingFromSelections as jest.Mock).mockReturnValue(new Promise(() => undefined));
    await openGuestReview();
    const send = screen.getByText('Send booking request');
    act(() => {
      fireEvent.press(send);
      fireEvent.press(send);
    });
    await settle();
    expect(createGuestBookingFromSelections).toHaveBeenCalledTimes(1);
  });
});
