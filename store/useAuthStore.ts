import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hydrateSupabaseSession, loadProfileForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
      setSessionData: (session, profile) =>
        set(session
          ? { session, profile, loading: false, guestMode: false, guestClientId: null }
          : { session: null, profile: null, loading: false }),
      setLoading: (loading) => set({ loading }),
      setPostAuthPath: (path) => set({ postAuthPath: path }),
      clearAuth: () => set({ session: null, profile: null, guestMode: false, postAuthPath: null, loading: false }),
    }),
    {
      name: 'autoserve-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // session is intentionally excluded — Supabase's own AsyncStorage is the
      // authoritative JWT store. Persisting session here too causes drift when
      // clearAuth/signOut doesn't perfectly sync both stores.
      partialize: (state) => ({
        profile: state.profile,
        guestMode: state.guestMode,
        guestClientId: state.guestClientId,
        postAuthPath: state.postAuthPath,
      }),
    }
  )
);

let initialized = false;

// Set to true while signIn/signInWithGoogle is actively running so the
// onAuthStateChange listener doesn't race with a duplicate profile load.
export let signingIn = false;
export function setSigningIn(value: boolean) { signingIn = value; }

export async function initAuthListener() {
  if (initialized) return;
  initialized = true;
  useAuthStore.getState().setLoading(true);
  const session = await hydrateSupabaseSession();

  if (!session) {
    useAuthStore.getState().setSessionData(null, useAuthStore.getState().profile);
  } else {
    const profile = await loadProfileForUser(session.userId, session.email);
    useAuthStore.getState().setSessionData(session, profile);
  }

  // Keep Zustand's in-memory session in sync with the Supabase JWT for the
  // lifetime of the app — this covers token refreshes and external sign-outs.
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (event === 'SIGNED_OUT' || !supabaseSession?.user) {
        useAuthStore.getState().setSessionData(null, null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const nextSession: AppSession = {
          userId: supabaseSession.user.id,
          email: supabaseSession.user.email ?? 'unknown@autoserve.app',
        };
        const existing = useAuthStore.getState().session;
        // Skip profile load if a sign-in function is already handling it to
        // avoid concurrent Supabase queries that can deadlock or hang.
        if (!signingIn && existing?.userId !== nextSession.userId) {
          const profile = await loadProfileForUser(nextSession.userId, nextSession.email);
          useAuthStore.getState().setSessionData(nextSession, profile);
        } else {
          useAuthStore.getState().setSessionData(nextSession, useAuthStore.getState().profile);
        }
      }
    });
  }
}
