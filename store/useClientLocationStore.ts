import * as Location from 'expo-location';
import { AppState, Linking } from 'react-native';
import { create } from 'zustand';

import {
  acquireClientLocation,
  ClientLocationStatus,
  LocationPermission,
  LocationRecoveryAction,
  PermissionPromptMode,
} from '@/lib/client-location';
import { Coordinates } from '@/lib/discovery-location';

interface ClientLocationState {
  status: ClientLocationStatus;
  permission: LocationPermission;
  canAskAgain: boolean;
  servicesEnabled: boolean | null;
  coordinates: Coordinates | null;
  isLoading: boolean;
  /** The Android enable-location dialog was declined or isn't available here. */
  enableDialogFailed: boolean;
  hasAutoPrompted: boolean;
  refresh: (mode?: PermissionPromptMode) => Promise<void>;
  recover: (action: LocationRecoveryAction) => Promise<void>;
}

const PROMPT_STRENGTH: Record<PermissionPromptMode, number> = { none: 0, 'first-use': 1, 'user-action': 2 };

let activeRefresh: Promise<void> | null = null;
let queuedMode: PermissionPromptMode | null = null;

function takeQueuedMode() {
  const mode = queuedMode;
  queuedMode = null;
  return mode;
}

export const useClientLocationStore = create<ClientLocationState>((set, get) => {
  const runRefreshes = async (initialMode: PermissionPromptMode) => {
    set({ isLoading: true });
    let mode: PermissionPromptMode | null = initialMode;
    while (mode) {
      const reading = await acquireClientLocation(mode);
      set((state) => ({
        status: reading.status,
        permission: reading.permission,
        canAskAgain: reading.canAskAgain,
        servicesEnabled: reading.servicesEnabled,
        // A failed read keeps the last good fix. Losing permission or device
        // location clears it, so stale distances can't outlive the client's choice.
        coordinates: reading.coordinates ?? (reading.status === 'retrieval_failed' ? state.coordinates : null),
        enableDialogFailed: reading.status === 'services_off' ? state.enableDialogFailed : false,
      }));
      mode = takeQueuedMode();
    }
    activeRefresh = null;
    set({ isLoading: false });
  };

  return {
    status: 'checking',
    permission: 'undetermined',
    canAskAgain: true,
    servicesEnabled: null,
    coordinates: null,
    isLoading: false,
    enableDialogFailed: false,
    hasAutoPrompted: false,

    refresh: (mode = 'none') => {
      if (activeRefresh) {
        // The running read may predate this request (for example, the client
        // changed Settings while it was in flight), so read once more afterwards.
        if (queuedMode === null || PROMPT_STRENGTH[mode] > PROMPT_STRENGTH[queuedMode]) {
          queuedMode = mode;
        }
        return activeRefresh;
      }
      activeRefresh = runRefreshes(mode);
      return activeRefresh;
    },

    recover: async (action) => {
      switch (action) {
        case 'request_permission':
          await get().refresh('user-action');
          return;
        case 'retry':
          await get().refresh();
          return;
        case 'open_settings':
          // The foreground listener refreshes when the client comes back.
          await Linking.openSettings().catch(() => undefined);
          return;
        case 'open_location_settings':
          await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
            Linking.openSettings().catch(() => undefined),
          );
          return;
        case 'enable_services':
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            set({ enableDialogFailed: true });
          }
          await get().refresh();
          return;
      }
    },
  };
});

/**
 * Keeps the shared location current while discovery is focused: refreshes now
 * and whenever the app returns to the foreground. Returns the cleanup, so it
 * can be passed straight to useFocusEffect. Only the first call can prompt.
 */
export function startClientLocationTracking() {
  const store = useClientLocationStore.getState();
  const mode: PermissionPromptMode = store.hasAutoPrompted ? 'none' : 'first-use';
  useClientLocationStore.setState({ hasAutoPrompted: true });
  void store.refresh(mode);

  let previousState = AppState.currentState;
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active' && previousState !== 'active') {
      void useClientLocationStore.getState().refresh();
    }
    previousState = nextState;
  });

  return () => subscription.remove();
}
