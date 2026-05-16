import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hydrateSupabaseSession, loadProfileForUser } from '@/lib/auth';
import { AppSession, UserProfile } from '@/types/domain';

interface AuthState {
  session: AppSession | null;
  profile: UserProfile | null;
  loading: boolean;
  guestMode: boolean;
  guestClientId: string | null;
  postAuthPath: string | null;
  setGuestMode: (enabled: boolean) => void;
  setSessionData: (session: AppSession | null, profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setPostAuthPath: (path: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      loading: true,
      guestMode: false,
      guestClientId: null,
      postAuthPath: null,
      setGuestMode: (enabled) =>
        set((state) => ({
          guestMode: enabled,
          guestClientId: enabled
            ? (state.guestClientId ?? `guest-${Date.now().toString(36)}`)
            : null,
        })),
      setSessionData: (session, profile) => set({ session, profile, loading: false }),
      setLoading: (loading) => set({ loading }),
      setPostAuthPath: (path) => set({ postAuthPath: path }),
      clearAuth: () => set({ session: null, profile: null, guestMode: false, postAuthPath: null, loading: false }),
    }),
    {
      name: 'autoserve-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        profile: state.profile,
        guestMode: state.guestMode,
        guestClientId: state.guestClientId,
        postAuthPath: state.postAuthPath,
      }),
    }
  )
);

let initialized = false;

export async function initAuthListener() {
  if (initialized) return;
  initialized = true;
  useAuthStore.getState().setLoading(true);
  const session = await hydrateSupabaseSession();

  if (!session) {
    useAuthStore.getState().setSessionData(null, useAuthStore.getState().profile);
    return;
  }

  const profile = await loadProfileForUser(session.userId, session.email);
  useAuthStore.getState().setSessionData(session, profile);
}
