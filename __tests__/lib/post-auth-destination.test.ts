import { getPostAuthDestination, shouldShowVendorApplicationStatus } from '@/lib/post-auth-destination';
import { VENDOR_APPLICATION_PATH, VENDOR_APPLICATION_STATUS_PATH } from '@/lib/route-gate';
import type { VendorApplicationStatus } from '@/types/domain';

const clientProfile = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'User',
  role: 'client' as const,
};

describe('shouldShowVendorApplicationStatus', () => {
  it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
    'returns true for %s',
    (status) => {
      expect(shouldShowVendorApplicationStatus(status)).toBe(true);
    },
  );

  it.each<VendorApplicationStatus | undefined>([undefined, 'draft', 'approved'])('returns false for %s', (status) => {
    expect(shouldShowVendorApplicationStatus(status)).toBe(false);
  });
});

describe('getPostAuthDestination', () => {
  it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
    'sends %s applications to the status screen even with an active vendor row',
    (applicationStatus) => {
      expect(
        getPostAuthDestination({
          profile: clientProfile,
          vendorCapability: { hasActiveVendor: true, applicationStatus },
          postAuthPath: null,
        }),
      ).toEqual({ path: VENDOR_APPLICATION_STATUS_PATH, clearPostAuthPath: true });
    },
  );

  it('sends approved active vendors to the vendor dashboard', () => {
    expect(
      getPostAuthDestination({
        profile: clientProfile,
        vendorCapability: { hasActiveVendor: true, applicationStatus: 'approved' },
        postAuthPath: null,
      }),
    ).toEqual({ path: '/(vendor)', clearPostAuthPath: true });
  });

  it('preserves Apply as Vendor post-auth routing through role selection', () => {
    expect(
      getPostAuthDestination({
        profile: null,
        vendorCapability: { hasActiveVendor: false },
        postAuthPath: VENDOR_APPLICATION_PATH,
      }),
    ).toEqual({ path: '/(auth)/role', clearPostAuthPath: false });
  });

  it('sends clients to the requested post-auth path', () => {
    expect(
      getPostAuthDestination({
        profile: clientProfile,
        vendorCapability: { hasActiveVendor: false },
        postAuthPath: '/(client)/booking/vehicle',
      }),
    ).toEqual({ path: '/(client)/booking/vehicle', clearPostAuthPath: true });
  });
});

// Ticket 11: complete the lifecycle role matrix — every actor lands somewhere
// safe and no non-approved actor reaches the vendor tabs.
describe('getPostAuthDestination lifecycle role matrix (ticket 11)', () => {
  it('guest with no profile and no pending application lands on role selection', () => {
    expect(
      getPostAuthDestination({
        profile: null,
        vendorCapability: { hasActiveVendor: false },
        postAuthPath: null,
      }),
    ).toEqual({ path: '/(auth)/role', clearPostAuthPath: true });
  });

  it('client with no requested path lands on the client home', () => {
    expect(
      getPostAuthDestination({
        profile: clientProfile,
        vendorCapability: { hasActiveVendor: false },
        postAuthPath: null,
      }),
    ).toEqual({ path: '/(client)', clearPostAuthPath: true });
  });

  it('draft application is not treated as pending and does not reach the vendor tabs', () => {
    // draft is excluded from STATUS_SCREEN_STATUSES; a draft-only applicant with
    // a client profile resumes the client experience rather than vendor ops.
    expect(
      getPostAuthDestination({
        profile: clientProfile,
        vendorCapability: { hasActiveVendor: false, applicationStatus: 'draft' },
        postAuthPath: null,
      }),
    ).toEqual({ path: '/(client)', clearPostAuthPath: true });
  });

  it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
    'never routes a %s applicant to the vendor tabs',
    (applicationStatus) => {
      const { path } = getPostAuthDestination({
        profile: clientProfile,
        vendorCapability: { hasActiveVendor: false, applicationStatus },
        postAuthPath: null,
      });
      expect(path).not.toBe('/(vendor)');
    },
  );
});
