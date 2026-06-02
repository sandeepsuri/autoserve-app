import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import { AppSession, BusinessType, UserProfile, UserRole } from '@/types/domain';

import { setSigningIn } from '@/store/useAuthStore';

import { isSupabaseConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

function makeDemoSession(email: string): AppSession {
  return {
    userId: `demo-${email.toLowerCase()}`,
    email,
  };
}

export async function hydrateSupabaseSession(): Promise<AppSession | null> {
  if (!isSupabaseConfigured || !supabase) {
    return useAuthStore.getState().session;
  }

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) {
    // Defensively clear any stale Supabase session storage.
    await supabase.auth.signOut().catch(() => {});
    return null;
  }
  return { userId: session.user.id, email: session.user.email ?? 'unknown@autoserve.app' };
}

export async function loadProfileForUser(userId: string, email: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore.getState().profiles.find((profile) => profile.id === userId) ?? {
      id: userId,
      email,
      fullName: email.split('@')[0],
    };
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data
    ? {
        id: data.id,
        email: data.email ?? email,
        fullName: data.full_name ?? email.split('@')[0],
        phone: data.phone ?? undefined,
        avatarUrl: data.avatar_url ?? undefined,
        role: data.role ?? undefined,
        businessType: data.business_type ?? undefined,
      }
    : { id: userId, email, fullName: email.split('@')[0] };
}

async function persistProfile(profile: UserProfile) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().addOrUpdateProfile(profile);
    return;
  }

  await supabase.from('profiles').upsert({
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    phone: profile.phone ?? null,
    avatar_url: profile.avatarUrl ?? null,
    role: profile.role ?? null,
    business_type: profile.businessType ?? null,
  });
}

export async function signIn(email: string, password: string) {
  if (!isSupabaseConfigured || !supabase) {
    const session = makeDemoSession(email);
    const profile = await loadProfileForUser(session.userId, session.email);
    useAuthStore.getState().setSessionData(session, profile);
    return { session, profile };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = { userId: data.user.id, email: data.user.email ?? email };
  const profile = await loadProfileForUser(session.userId, session.email);
  useAuthStore.getState().setSessionData(session, profile);
  return { session, profile };
}

export async function signUp(email: string, password: string, fullName: string) {
  if (!isSupabaseConfigured || !supabase) {
    const session = makeDemoSession(email);
    const profile = { id: session.userId, email, fullName };
    await persistProfile(profile);
    useAuthStore.getState().setSessionData(session, profile);
    return { session, profile };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  const hasSession = Boolean(data.session);
  const session = hasSession && data.user ? { userId: data.user.id, email: data.user.email ?? email } : null;
  const profile = session ? { id: session.userId, email: session.email, fullName } : null;
  if (session && profile) {
    await persistProfile(profile);
    useAuthStore.getState().setSessionData(session, profile);
  }
  return { session, profile, needsConfirmation: !hasSession };
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
    const session = makeDemoSession('guest.google@autoserve.app');
    const profile = { id: session.userId, email: session.email, fullName: 'Google Driver' };
    await persistProfile(profile);
    useAuthStore.getState().setSessionData(session, profile);
    return true;
  }

  const redirectTo = 'autoserve://auth/callback';
  console.log('[Google] Starting OAuth, redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  console.log('[Google] OAuth URL obtained, opening browser');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[Google] Browser result type:', result.type, 'url:', result.type === 'success' ? result.url : 'n/a');

  if (result.type !== 'success') {
    console.log('[Google] Browser did not return success, returning false');
    return false;
  }

  const parsedUrl = new URL(result.url);
  const errorParam = parsedUrl.searchParams.get('error') ?? parsedUrl.searchParams.get('error_description');
  if (errorParam) throw new Error(errorParam);

  const code = parsedUrl.searchParams.get('code');
  console.log('[Google] Extracted code:', code ? `${code.slice(0, 8)}...` : 'NULL');
  if (!code) throw new Error('No auth code in callback URL.');

  setSigningIn(true);
  try {
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    console.log('[Google] exchangeCodeForSession error:', exchangeError?.message ?? 'none');
    if (exchangeError) throw exchangeError;

    const session = {
      userId: sessionData.user.id,
      email: sessionData.user.email ?? 'google@autoserve.app',
    };
    console.log('[Google] Session established for userId:', session.userId);

    const profile = await loadProfileForUser(session.userId, session.email).catch(() => null);
    console.log('[Google] Profile loaded, role:', profile?.role ?? 'none');

    useAuthStore.getState().setSessionData(session, profile);
    console.log('[Google] Auth store updated, returning true');
    return true;
  } finally {
    setSigningIn(false);
  }
}

export async function ensureProfileRow(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { session, profile } = useAuthStore.getState();
  if (!session) return;

  await supabase.from('profiles').upsert(
    {
      id: session.userId,
      email: session.email,
      full_name: profile?.fullName ?? session.email.split('@')[0],
      role: profile?.role ?? null,
      business_type: profile?.businessType ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: false },
  );
}

export async function setRole(role: UserRole, businessType?: BusinessType) {
  const { session, profile } = useAuthStore.getState();
  if (!session) throw new Error('No active session');

  const nextProfile: UserProfile = {
    id: session.userId,
    email: session.email,
    fullName: profile?.fullName ?? session.email.split('@')[0],
    phone: profile?.phone,
    avatarUrl: profile?.avatarUrl,
    role,
    businessType: role === 'vendor' ? businessType : undefined,
  };

  await persistProfile(nextProfile);
  useAuthStore.getState().setSessionData(session, nextProfile);
}

export async function signOut() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  useAuthStore.getState().clearAuth();
  useVendorOnboardingStore.getState().reset();
}
