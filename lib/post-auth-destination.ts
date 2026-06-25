import { VENDOR_APPLICATION_PATH, VENDOR_APPLICATION_STATUS_PATH } from '@/lib/route-gate';
import type { UserProfile, VendorApplicationStatus } from '@/types/domain';

const STATUS_SCREEN_STATUSES: VendorApplicationStatus[] = [
  'submitted',
  'under_review',
  'needs_more_info',
  'rejected',
  'suspended',
];

type PostAuthDestinationInput = {
  profile: UserProfile | null;
  vendorCapability: { hasActiveVendor: boolean; applicationStatus?: VendorApplicationStatus } | null;
  postAuthPath?: string | null;
};

export function shouldShowVendorApplicationStatus(status?: VendorApplicationStatus) {
  return Boolean(status && STATUS_SCREEN_STATUSES.includes(status));
}

export function getPostAuthDestination({ profile, vendorCapability, postAuthPath }: PostAuthDestinationInput) {
  if (shouldShowVendorApplicationStatus(vendorCapability?.applicationStatus)) {
    return { path: VENDOR_APPLICATION_STATUS_PATH, clearPostAuthPath: true };
  }

  if (vendorCapability?.hasActiveVendor) {
    return { path: '/(vendor)', clearPostAuthPath: true };
  }

  if (profile?.role === 'client') {
    return { path: postAuthPath || '/(client)', clearPostAuthPath: true };
  }

  return {
    path: '/(auth)/role',
    clearPostAuthPath: postAuthPath !== VENDOR_APPLICATION_PATH,
  };
}
