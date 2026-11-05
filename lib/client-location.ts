import * as Location from 'expo-location';

import { Coordinates, isValidCoordinates } from './discovery-location';

const POSITION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

export type LocationPermission = 'undetermined' | 'granted' | 'denied';

export type ClientLocationStatus = 'checking' | 'ready' | 'denied' | 'services_off' | 'retrieval_failed';

/**
 * none: only read current state (foreground and focus refreshes).
 * first-use: show the OS prompt if the client has never answered it.
 * user-action: the client tapped Allow, so ask whenever the OS still permits it.
 */
export type PermissionPromptMode = 'none' | 'first-use' | 'user-action';

export type LocationRecoveryAction =
  | 'request_permission'
  | 'open_settings'
  | 'enable_services'
  | 'open_location_settings'
  | 'retry';

export interface ClientLocationReading {
  status: Exclude<ClientLocationStatus, 'checking'>;
  permission: LocationPermission;
  canAskAgain: boolean;
  servicesEnabled: boolean | null;
  coordinates: Coordinates | null;
}

export interface LocationRecovery {
  title: string;
  body: string;
  actionLabel: string;
  action: LocationRecoveryAction;
}

function shouldPrompt(
  permission: Location.LocationPermissionResponse,
  mode: PermissionPromptMode,
) {
  if (permission.granted || !permission.canAskAgain) return false;
  if (mode === 'user-action') return true;
  return mode === 'first-use' && permission.status === Location.PermissionStatus.UNDETERMINED;
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out reading the device location.')), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function toCoordinates(position: Location.LocationObject | null | undefined): Coordinates | null {
  const coords = position?.coords;
  return isValidCoordinates(coords) ? { latitude: coords.latitude, longitude: coords.longitude } : null;
}

async function readPosition(): Promise<Coordinates | null> {
  try {
    const current = toCoordinates(
      await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        POSITION_TIMEOUT_MS,
      ),
    );
    if (current) return current;
  } catch {
    // Fall through: a recent fix is still better than no position at all.
  }

  try {
    return toCoordinates(await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }));
  } catch {
    return null;
  }
}

/** Reads permission, then device services, then position, and never rejects. */
export async function acquireClientLocation(mode: PermissionPromptMode = 'none'): Promise<ClientLocationReading> {
  let permission: LocationPermission = 'undetermined';
  let canAskAgain = true;
  let servicesEnabled: boolean | null = null;

  try {
    let response = await Location.getForegroundPermissionsAsync();
    if (shouldPrompt(response, mode)) {
      response = await Location.requestForegroundPermissionsAsync();
    }
    permission = response.granted ? 'granted' : response.status === Location.PermissionStatus.DENIED ? 'denied' : 'undetermined';
    canAskAgain = response.canAskAgain;

    if (!response.granted) {
      return { status: 'denied', permission, canAskAgain, servicesEnabled, coordinates: null };
    }

    servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return { status: 'services_off', permission, canAskAgain, servicesEnabled, coordinates: null };
    }

    const coordinates = await readPosition();
    return {
      status: coordinates ? 'ready' : 'retrieval_failed',
      permission,
      canAskAgain,
      servicesEnabled,
      coordinates,
    };
  } catch {
    return { status: 'retrieval_failed', permission, canAskAgain, servicesEnabled, coordinates: null };
  }
}

interface RecoveryInput {
  status: ClientLocationStatus;
  canAskAgain: boolean;
  hasLastPosition: boolean;
  enableDialogFailed: boolean;
  platform: string;
}

/** What the client sees and can do when their location isn't usable. */
export function describeLocationRecovery({
  status,
  canAskAgain,
  hasLastPosition,
  enableDialogFailed,
  platform,
}: RecoveryInput): LocationRecovery | null {
  switch (status) {
    case 'denied':
      return canAskAgain
        ? {
            title: 'See shops near you',
            body: 'Allow location to sort shops by distance. You can keep browsing without it.',
            actionLabel: 'Allow location',
            action: 'request_permission',
          }
        : {
            title: 'Location is turned off for AutoServe',
            body: 'Allow it in Settings to sort shops by distance. You can keep browsing without it.',
            actionLabel: 'Open Settings',
            action: 'open_settings',
          };
    case 'services_off':
      if (platform === 'android') {
        return {
          title: 'Your device location is off',
          body: 'Turn it on to sort shops by distance. You can keep browsing without it.',
          actionLabel: enableDialogFailed ? 'Open location settings' : 'Turn on location',
          action: enableDialogFailed ? 'open_location_settings' : 'enable_services',
        };
      }
      return {
        title: 'Your device location is off',
        body: 'Turn on Location Services under Settings > Privacy & Security. You can keep browsing without it.',
        actionLabel: 'Open Settings',
        action: 'open_settings',
      };
    case 'retrieval_failed':
      return {
        title: hasLastPosition ? 'Could not update your location' : 'Could not find your location',
        body: hasLastPosition
          ? 'Distances are based on your last known position.'
          : 'Try again, or keep browsing without distances.',
        actionLabel: 'Try again',
        action: 'retry',
      };
    default:
      return null;
  }
}
