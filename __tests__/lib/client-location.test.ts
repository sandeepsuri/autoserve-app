jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  enableNetworkProviderAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Linking: { openSettings: jest.fn(), sendIntent: jest.fn() },
}));

import * as Location from 'expo-location';
import { AppState, Linking } from 'react-native';

import { describeLocationRecovery } from '@/lib/client-location';
import { startClientLocationTracking, useClientLocationStore } from '@/store/useClientLocationStore';

const mocked = Location as jest.Mocked<typeof Location>;
const HERE = { latitude: 43.65, longitude: -79.38 };
const MOVED = { latitude: 43.8, longitude: -79.5 };
const initialState = useClientLocationStore.getState();

const permission = (status: 'granted' | 'denied' | 'undetermined', canAskAgain = true) =>
  ({ status, granted: status === 'granted', canAskAgain, expires: 'never' }) as Location.LocationPermissionResponse;
const position = (coords: { latitude: number; longitude: number }) =>
  ({ coords, timestamp: 1 }) as Location.LocationObject;

function deviceIs(state: {
  permission?: Location.LocationPermissionResponse;
  servicesEnabled?: boolean;
  coords?: { latitude: number; longitude: number };
}) {
  mocked.getForegroundPermissionsAsync.mockResolvedValue(state.permission ?? permission('granted'));
  mocked.hasServicesEnabledAsync.mockResolvedValue(state.servicesEnabled ?? true);
  mocked.getCurrentPositionAsync.mockResolvedValue(position(state.coords ?? HERE));
}

const store = () => useClientLocationStore.getState();
let foregroundListener: (state: string) => void;
const removeListener = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  useClientLocationStore.setState(initialState, true);
  mocked.getLastKnownPositionAsync.mockResolvedValue(null);
  (AppState.addEventListener as jest.Mock).mockImplementation((_type, listener) => {
    foregroundListener = listener;
    return { remove: removeListener };
  });
  (Linking.openSettings as jest.Mock).mockResolvedValue(undefined);
  (Linking.sendIntent as jest.Mock).mockResolvedValue(undefined);
});

describe('Android location states', () => {
  it('granted with services on: exposes coordinates and ready', async () => {
    deviceIs({});
    await store().refresh();
    expect(store()).toMatchObject({
      status: 'ready',
      permission: 'granted',
      servicesEnabled: true,
      coordinates: HERE,
      isLoading: false,
    });
  });

  it('granted with services off: reports it without reading a position', async () => {
    deviceIs({ servicesEnabled: false });
    await store().refresh();
    expect(store()).toMatchObject({ status: 'services_off', permission: 'granted', servicesEnabled: false, coordinates: null });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('denied: reports it without checking services or position', async () => {
    deviceIs({ permission: permission('denied') });
    await store().refresh();
    expect(store()).toMatchObject({ status: 'denied', permission: 'denied', canAskAgain: true, coordinates: null });
    expect(mocked.hasServicesEnabledAsync).not.toHaveBeenCalled();
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('denied for good: records that the OS will not ask again', async () => {
    deviceIs({ permission: permission('denied', false) });
    await store().refresh('user-action');
    expect(store()).toMatchObject({ status: 'denied', canAskAgain: false });
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('retrieval failure: reports it and shows loading while reading', async () => {
    deviceIs({});
    let rejectPosition: (error: Error) => void = () => undefined;
    mocked.getCurrentPositionAsync.mockReturnValue(
      new Promise((_, reject) => {
        rejectPosition = reject;
      }),
    );
    const refreshing = store().refresh();
    expect(store().isLoading).toBe(true);
    rejectPosition(new Error('no fix'));
    await refreshing;
    expect(store()).toMatchObject({ status: 'retrieval_failed', coordinates: null, isLoading: false });
  });

  it('retrieval failure: falls back to a recent last-known position', async () => {
    deviceIs({});
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
    mocked.getLastKnownPositionAsync.mockResolvedValue(position(MOVED));
    await store().refresh();
    expect(store()).toMatchObject({ status: 'ready', coordinates: MOVED });
  });

  it('retrieval failure: a hung position read times out instead of loading forever', async () => {
    jest.useFakeTimers();
    try {
      deviceIs({});
      mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
      const refreshing = store().refresh();
      await jest.advanceTimersByTimeAsync(10_000);
      await refreshing;
      expect(store()).toMatchObject({ status: 'retrieval_failed', isLoading: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it('retrieval failure: an invalid fix is never used as the position', async () => {
    deviceIs({ coords: { latitude: 0, longitude: 0 } });
    await store().refresh();
    expect(store()).toMatchObject({ status: 'retrieval_failed', coordinates: null });
  });

  it('retrieval failure: a permission API error does not reject', async () => {
    mocked.getForegroundPermissionsAsync.mockRejectedValue(new Error('native failure'));
    await expect(store().refresh()).resolves.toBeUndefined();
    expect(store()).toMatchObject({ status: 'retrieval_failed', isLoading: false });
  });
});

describe('keeping and clearing the last position', () => {
  beforeEach(async () => {
    deviceIs({});
    await store().refresh();
  });

  it('keeps the last fix when a later read fails', async () => {
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
    await store().refresh();
    expect(store()).toMatchObject({ status: 'retrieval_failed', coordinates: HERE });
  });

  it('clears it when permission is revoked', async () => {
    deviceIs({ permission: permission('denied', false) });
    await store().refresh();
    expect(store()).toMatchObject({ status: 'denied', coordinates: null });
  });

  it('clears it when device location is turned off', async () => {
    deviceIs({ servicesEnabled: false });
    await store().refresh();
    expect(store()).toMatchObject({ status: 'services_off', coordinates: null });
  });
});

describe('permission prompting', () => {
  it('prompts on the first discovery visit only', async () => {
    deviceIs({ permission: permission('undetermined') });
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission('denied'));

    const stopFirst = startClientLocationTracking();
    await store().refresh();
    stopFirst();
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    const stopSecond = startClientLocationTracking();
    foregroundListener('background');
    foregroundListener('active');
    await store().refresh();
    stopSecond();
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not prompt a client who already denied until they ask to', async () => {
    deviceIs({ permission: permission('denied') });
    startClientLocationTracking()();
    await store().refresh();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission('granted'));
    await store().recover('request_permission');
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(store()).toMatchObject({ status: 'ready', coordinates: HERE });
  });
});

describe('foreground refresh', () => {
  it('re-reads the position when the app returns to the foreground', async () => {
    deviceIs({});
    const stop = startClientLocationTracking();
    await store().refresh();
    expect(store().coordinates).toEqual(HERE);

    deviceIs({ coords: MOVED });
    foregroundListener('background');
    foregroundListener('active');
    await store().refresh();
    expect(store().coordinates).toEqual(MOVED);
    stop();
  });

  it('recovers after the client enables permission in Settings', async () => {
    deviceIs({ permission: permission('denied', false) });
    const stop = startClientLocationTracking();
    await store().refresh();
    expect(store().status).toBe('denied');

    await store().recover('open_settings');
    expect(Linking.openSettings).toHaveBeenCalled();
    foregroundListener('background');

    deviceIs({});
    foregroundListener('active');
    await store().refresh();
    expect(store()).toMatchObject({ status: 'ready', coordinates: HERE });
    stop();
  });

  it('recovers after the client turns device location back on', async () => {
    deviceIs({ servicesEnabled: false });
    const stop = startClientLocationTracking();
    await store().refresh();
    expect(store().status).toBe('services_off');

    deviceIs({});
    foregroundListener('background');
    foregroundListener('active');
    await store().refresh();
    expect(store()).toMatchObject({ status: 'ready', coordinates: HERE });
    stop();
  });

  it('ignores changes that are not a return to the foreground', async () => {
    deviceIs({});
    const stop = startClientLocationTracking();
    await store().refresh();
    mocked.getForegroundPermissionsAsync.mockClear();
    foregroundListener('active');
    foregroundListener('background');
    expect(mocked.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    stop();
  });

  it('stops listening when discovery loses focus', () => {
    deviceIs({});
    startClientLocationTracking()();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});

describe('overlapping refreshes', () => {
  it('runs one at a time, then reads once more so a Settings change is not lost', async () => {
    deviceIs({ permission: permission('denied') });
    let releaseFirst: (value: Location.LocationPermissionResponse) => void = () => undefined;
    mocked.getForegroundPermissionsAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseFirst = resolve;
      }),
    );

    const first = store().refresh();
    store().refresh();
    store().refresh();
    expect(mocked.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    deviceIs({});
    releaseFirst(permission('denied'));
    await first;

    expect(mocked.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
    expect(store()).toMatchObject({ status: 'ready', coordinates: HERE, isLoading: false });
  });
});

describe('turning on device location', () => {
  it('uses the Android dialog, then refreshes', async () => {
    deviceIs({});
    mocked.enableNetworkProviderAsync.mockResolvedValue();
    await store().recover('enable_services');
    expect(store()).toMatchObject({ status: 'ready', enableDialogFailed: false });
  });

  it('switches to the settings action when the dialog is declined', async () => {
    deviceIs({ servicesEnabled: false });
    mocked.enableNetworkProviderAsync.mockRejectedValue(new Error('declined'));
    await store().recover('enable_services');
    expect(store()).toMatchObject({ status: 'services_off', enableDialogFailed: true });
    expect(
      describeLocationRecovery({
        status: store().status,
        canAskAgain: store().canAskAgain,
        hasLastPosition: false,
        enableDialogFailed: store().enableDialogFailed,
        platform: 'android',
      })?.action,
    ).toBe('open_location_settings');

    await store().recover('open_location_settings');
    expect(Linking.sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
  });
});

describe('describeLocationRecovery', () => {
  const describeFor = (overrides: Partial<Parameters<typeof describeLocationRecovery>[0]>) =>
    describeLocationRecovery({
      status: 'denied',
      canAskAgain: true,
      hasLastPosition: false,
      enableDialogFailed: false,
      platform: 'android',
      ...overrides,
    });

  it('has no recovery when ready or still checking', () => {
    expect(describeFor({ status: 'ready' })).toBeNull();
    expect(describeFor({ status: 'checking' })).toBeNull();
  });

  it('maps each unavailable state to an action', () => {
    expect(describeFor({ canAskAgain: true })?.action).toBe('request_permission');
    expect(describeFor({ canAskAgain: false })?.action).toBe('open_settings');
    expect(describeFor({ status: 'services_off' })?.action).toBe('enable_services');
    expect(describeFor({ status: 'services_off', platform: 'ios' })?.action).toBe('open_settings');
    expect(describeFor({ status: 'retrieval_failed' })?.action).toBe('retry');
  });

  it('tells the client when distances rest on an older position', () => {
    expect(describeFor({ status: 'retrieval_failed', hasLastPosition: true })?.body).toContain('last known');
  });

  it('tells the client browsing still works in the blocking states', () => {
    for (const status of ['denied', 'services_off', 'retrieval_failed'] as const) {
      expect(describeFor({ status })?.body).toMatch(/browsing/);
    }
  });
});
