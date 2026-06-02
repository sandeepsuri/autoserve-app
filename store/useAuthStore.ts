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
    (set, get) => ({
      session: null,
      profile: null,
      loading: true,
      guestMode: false,
      guestClientId: null,
      postAuthPath: null,
      setGuestMode: (enabled) =>
        set((state) => ({
          guestMode: enabled,
          // Guest ids are persisted only to keep demo-store vehicles/drafts
          // reachable while browsing before auth. setSessionData clears them
          // once a real user session exists.
          guestClientId: enabled
            ? (state.guestClientId ?? `guest-${Date.now().toString(36)}`)
            : null,
        })),
      setSessionData: (session, profile) =>
        set({
          session,
          profile: session ? profile : null,
          loading: false,
          // Guest mode survives refresh without a JWT, but is cleared as soon
          // as a real session is established so guest-owned draft data cannot
          // bleed into signed-in paths.
          guestMode: session ? false : get().guestMode,
          guestClientId: session ? null : get().guestClientId,
        }),
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
        if (existing?.userId !== nextSession.userId) {
          const profile = await loadProfileForUser(nextSession.userId, nextSession.email);
          useAuthStore.getState().setSessionData(nextSession, profile);
        } else {
          useAuthStore.getState().setSessionData(nextSession, useAuthStore.getState().profile);
        }
      }
    });
  }
}
