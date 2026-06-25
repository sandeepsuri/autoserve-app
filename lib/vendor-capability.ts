import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { VendorApplicationStatus } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

export interface VendorCapability {
  hasActiveVendor: boolean;
  applicationStatus?: VendorApplicationStatus;
}

const NO_CAPABILITY: VendorCapability = { hasActiveVendor: false };

/**
 * Derives vendor capability from server state rather than `profiles.role`.
 * Under Option B, `approve_vendor_application` never sets `profiles.role`;
 * capability = the user owns a `vendors` row with `is_active = true`.
 *
 * Safe to call during auth hydration — never throws, returns a "no
 * capability" result for unauthenticated/missing-session callers (mirrors
 * `getVendorForOwner()`'s null-safety rather than `requireSession()`'s
 * throw style used elsewhere in onboarding).
 */
export async function loadVendorCapability(): Promise<VendorCapability> {
  const ownerId = useAuthStore.getState().session?.userId;
  if (!ownerId) return NO_CAPABILITY;

  if (!isSupabaseConfigured || !supabase) {
    const demo = useDemoDataStore.getState();
    const vendor = demo.vendors.find((v) => v.ownerId === ownerId);
    const application = demo.vendorApplications.find((v) => v.ownerId === ownerId);
    return {
      // Demo vendors have no `isActive` field — presence in the array is
      // treated as active, matching today's demo behavior.
      hasActiveVendor: Boolean(vendor),
      applicationStatus: application?.status,
    };
  }

  // Query the active row explicitly rather than relying on `.maybeSingle()`
  // across *all* of an owner's vendor rows: an owner can accumulate more
  // than one `vendors` row across approve/reset cycles (e.g. a deactivated
  // row plus a newly-approved active row). `.maybeSingle()` errors when more
  // than one row matches its filter, which previously made this function
  // silently fall back to `hasActiveVendor: false` on every other call —
  // flip-flopping the capability value and ping-ponging route-gate redirects
  // between (vendor) and (client) until React's update-depth limit tripped.
  // Filtering on `is_active = true` and capping to one row keeps this
  // deterministic no matter how many historical rows exist.
  const [vendorResult, applicationResult] = await Promise.all([
    supabase
      .from('vendors')
      .select('id,is_active')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('vendor_applications')
      .select('status')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hasActiveVendor = Boolean(vendorResult.data);
  const applicationStatus = applicationResult.data?.status as VendorApplicationStatus | undefined;

  return { hasActiveVendor, applicationStatus };
}
