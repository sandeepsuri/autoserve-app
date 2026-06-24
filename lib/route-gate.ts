import type { UserProfile } from '@/types/domain';

export const VENDOR_APPLICATION_PATH = '/(auth)/vendor-setup';

type RouteGateInput = {
  segments: string[];
  session: unknown | null;
  profile: UserProfile | null;
  loading: boolean;
  guestMode: boolean;
  postAuthPath?: string | null;
};

export function getRouteGateRedirect({
  segments,
  session,
  profile,
  loading,
  guestMode,
  postAuthPath,
}: RouteGateInput): string | null {
  if (loading) return null;

  const rootSegment = segments[0] ?? '(public)';
  const inAuth = rootSegment === '(auth)';
  const inVendor = rootSegment === '(vendor)';
  const inClient = rootSegment === '(client)';
  const inPublic = rootSegment === '(public)';
  const routeName = segments[1];
  const pendingVendorApplication = postAuthPath === VENDOR_APPLICATION_PATH;

  if (inPublic && routeName === 'welcome' && session && profile?.role === 'client') {
    return '/(client)';
  }

  if (inPublic && routeName === 'welcome' && session && profile?.role === 'vendor') {
    return profile.businessType ? '/(vendor)' : '/(auth)/vendor-onboarding';
  }

  if (inAuth && session && profile?.role === 'vendor') {
    const onboardingDone = Boolean(profile.businessType);
    const inOnboarding = routeName === 'vendor-onboarding' || routeName === 'vendor-setup';
    if (!onboardingDone && !inOnboarding) {
      return '/(auth)/vendor-onboarding';
    }
    if (onboardingDone && !inOnboarding) {
      return '/(vendor)';
    }
  }

  if (inAuth && session && profile?.role === 'client') {
    const inVendorApplication = routeName === 'vendor-setup' || routeName === 'vendor-onboarding';
    if (routeName === 'role' && pendingVendorApplication) {
      return VENDOR_APPLICATION_PATH;
    }
    if (!inVendorApplication) {
      return '/(client)';
    }
  }

  if (session && !profile?.role && !inAuth) {
    return '/(auth)/role';
  }

  if (inAuth && routeName === 'role' && !session) {
    return '/(auth)';
  }

  if (inVendor && session && profile?.role === 'vendor' && !profile.businessType) {
    return '/(auth)/vendor-onboarding';
  }

  if (inVendor && (!session || profile?.role !== 'vendor')) {
    return '/(auth)';
  }

  if (inClient && session && profile?.role === 'vendor') {
    return '/(vendor)';
  }

  if (inClient && !session && !guestMode) {
    return '/(auth)';
  }

  if (!inPublic && !inAuth && !inClient && !inVendor) {
    return '/(public)/welcome';
  }

  return null;
}
