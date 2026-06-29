// Vendor application route constants.
//
// The continuous RouteGate redirect logic that used to live here was removed
// once post-sign-in routing moved to `lib/post-auth-destination.ts` (vendor
// access is gated by post-auth routing + backend RLS, not a global gate).
// These path constants are still shared across the auth/onboarding screens.

export const VENDOR_APPLICATION_PATH = '/(auth)/vendor-setup';

export const VENDOR_APPLICATION_STATUS_PATH = '/(auth)/vendor-onboarding/status';
