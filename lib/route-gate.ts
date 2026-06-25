import type { UserProfile, VendorApplicationStatus } from '@/types/domain';

export const VENDOR_APPLICATION_PATH = '/(auth)/vendor-setup';

// Applicant statuses that get a dedicated status page and can never reach
// vendor tabs (rejected / needs_more_info / suspended). `submitted` and
// `under_review` keep using the existing pending screen (complete.tsx) when
// reached via the live submit-application flow, but also route to the
// status page when a fresh/unhydrated session lands on /role (see the
// "already-known applicant" guard below) — complete.tsx relies on the local
// onboarding draft store, which is empty on a fresh session.
const BLOCKED_APPLICATION_STATUSES: VendorApplicationStatus[] = ['rejected', 'needs_more_info', 'suspended'];
const PENDING_APPLICATION_STATUSES: VendorApplicationStatus[] = ['submitted', 'under_review'];

export const VENDOR_APPLICATION_STATUS_PATH = '/(auth)/vendor-onboarding/status';

type RouteGateVendorCapability = {
  hasActiveVendor: boolean;
  applicationStatus?: VendorApplicationStatus;
} | null | undefined;

type RouteGateInput = {
  segments: string[];
  session: unknown | null;
  profile: UserProfile | null;
  vendorCapability?: RouteGateVendorCapability;
  loading: boolean;
  guestMode: boolean;
  postAuthPath?: string | null;
};

export function getRouteGateRedirect(input: RouteGateInput): string | null {
  const redirect = computeRouteGateRedirect(input);
  if (!redirect) return null;
  // Loop-breaker: a redirect to the route we're already on can only thrash
  // expo-router's <Redirect> mount effect (navigate → re-render → re-mount →
  // navigate again → "Maximum update depth exceeded"). Never emit a redirect
  // equal to the current location, regardless of which branch produced it.
  const currentPath = `/${(input.segments ?? []).join('/')}`;
  return redirect === currentPath ? null : redirect;
}

function computeRouteGateRedirect({
  segments,
  session,
  profile,
  vendorCapability,
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
  const isApplicationStatusRoute = inAuth && routeName === 'vendor-onboarding' && segments[2] === 'status';
  const pendingVendorApplication = postAuthPath === VENDOR_APPLICATION_PATH;

  const hasActiveVendor = vendorCapability?.hasActiveVendor === true;
  // While a session exists but `vendorCapability` hasn't loaded yet
  // (`null`/`undefined` — the store's initial/cleared sentinel, also true
  // briefly during initAuthListener: setSessionData flips `loading` to
  // false before loadVendorCapability() resolves), treat capability as
  // "unknown" rather than collapsing it into `hasActiveVendor: false`.
  // Otherwise a momentary unknown reading right after a relaunch/approval
  // bounces an already-approved vendor out of /(vendor) into /(client),
  // which (once capability loads true) immediately bounces them back,
  // repeating until React's update-depth limit trips. Without a session,
  // there is nothing pending to load, so capability is treated as known
  // (no active vendor) rather than "unknown".
  const capabilityUnknown = Boolean(session) && vendorCapability == null;
  const blockedApplicationStatus =
    vendorCapability?.applicationStatus && BLOCKED_APPLICATION_STATUSES.includes(vendorCapability.applicationStatus)
      ? vendorCapability.applicationStatus
      : undefined;
  const hasRenderableApplicationStatus = Boolean(
    vendorCapability?.applicationStatus &&
      [...BLOCKED_APPLICATION_STATUSES, ...PENDING_APPLICATION_STATUSES].includes(vendorCapability.applicationStatus),
  );

  if (session && hasRenderableApplicationStatus) {
    if (isApplicationStatusRoute) return null;
    if (inVendor || inClient || inPublic) return VENDOR_APPLICATION_STATUS_PATH;
    if (inAuth && routeName === 'role' && !pendingVendorApplication) return VENDOR_APPLICATION_STATUS_PATH;
    if (inAuth && routeName === 'vendor-onboarding') return VENDOR_APPLICATION_STATUS_PATH;
  }

  if (inPublic && routeName === 'welcome' && session && profile?.role === 'client') {
    if (hasActiveVendor) return '/(vendor)';
    return '/(client)';
  }

  // A signed-in user who already has ANY application status (draft through
  // suspended) or active vendor capability must never see role selection
  // again — route them to their real state instead. The pending
  // "Apply as Vendor" tap-through (postAuthPath === VENDOR_APPLICATION_PATH,
  // no applicationStatus yet) is handled separately below and must take
  // precedence, so this guard explicitly steps aside for it.
  if (inAuth && session && routeName === 'role' && !pendingVendorApplication) {
    if (hasActiveVendor) {
      return '/(vendor)';
    }
    if (vendorCapability?.applicationStatus && BLOCKED_APPLICATION_STATUSES.includes(vendorCapability.applicationStatus)) {
      return VENDOR_APPLICATION_STATUS_PATH;
    }
    if (vendorCapability?.applicationStatus && PENDING_APPLICATION_STATUSES.includes(vendorCapability.applicationStatus)) {
      // Not complete.tsx: that screen derives its state from the local
      // onboarding draft store, which is empty on a fresh session and would
      // incorrectly bounce the user into the editable wizard. The status
      // page reads vendorCapability directly, which is always loaded.
      return VENDOR_APPLICATION_STATUS_PATH;
    }
    if (vendorCapability?.applicationStatus === 'draft') {
      return '/(auth)/vendor-onboarding';
    }
  }

  if (inAuth && session && hasActiveVendor) {
    const inOnboarding = routeName === 'vendor-onboarding' || routeName === 'vendor-setup';
    if (segments[2] === 'status') {
      return '/(vendor)';
    }
    if (!inOnboarding) {
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
    // rejected / needs_more_info / suspended applicants get a dedicated
    // status page and cannot continue into the editable wizard steps or the
    // pending-review screen — only the status route itself is allowed.
    if (blockedApplicationStatus && segments[2] !== 'status') {
      return VENDOR_APPLICATION_STATUS_PATH;
    }
    if (isApplicationStatusRoute && !hasRenderableApplicationStatus) {
      return '/(client)';
    }
  }

  if (session && !profile?.role && !inAuth) {
    return '/(auth)/role';
  }

  if (inAuth && routeName === 'role' && !session) {
    return '/(auth)';
  }

  if (inVendor && !session) {
    return '/(auth)';
  }

  if (inVendor && session && !hasActiveVendor && !capabilityUnknown) {
    return '/(client)';
  }

  if (inClient && session && hasActiveVendor) {
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
