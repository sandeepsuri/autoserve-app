import { getRouteGateRedirect, VENDOR_APPLICATION_PATH, VENDOR_APPLICATION_STATUS_PATH } from '@/lib/route-gate';
import type { UserProfile, VendorApplicationStatus } from '@/types/domain';

const session = { userId: 'user-1', email: 'user@example.com' };

function profile(patch: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    ...patch,
  };
}

function capability(hasActiveVendor: boolean, applicationStatus?: VendorApplicationStatus) {
  return { hasActiveVendor, applicationStatus };
}

function redirectFor(input: Partial<Parameters<typeof getRouteGateRedirect>[0]>) {
  return getRouteGateRedirect({
    segments: ['(public)', 'welcome'],
    session: null,
    profile: null,
    vendorCapability: null,
    loading: false,
    guestMode: false,
    postAuthPath: null,
    ...input,
  });
}

describe('route gate redirects', () => {
  it('sends signed-in users without a role to role selection outside auth', () => {
    expect(
      redirectFor({
        segments: ['(client)'],
        session,
        profile: profile(),
      }),
    ).toBe('/(auth)/role');
  });

  it('sends clients on normal auth routes to the client app', () => {
    expect(
      redirectFor({
        segments: ['(auth)'],
        session,
        profile: profile({ role: 'client' }),
      }),
    ).toBe('/(client)');
  });

  it('sends clients from role selection to vendor setup when application is pending', () => {
    expect(
      redirectFor({
        segments: ['(auth)', 'role'],
        session,
        profile: profile({ role: 'client' }),
        postAuthPath: VENDOR_APPLICATION_PATH,
      }),
    ).toBe(VENDOR_APPLICATION_PATH);
  });

  it('allows clients to stay inside vendor onboarding application routes', () => {
    expect(
      redirectFor({
        segments: ['(auth)', 'vendor-onboarding'],
        session,
        profile: profile({ role: 'client' }),
      }),
    ).toBeNull();
  });

  describe('vendor capability gating', () => {
    it('blocks a client with no vendor capability from vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(false),
        }),
      ).toBe('/(client)');
    });

    it('blocks a guest (no session) from vendor tabs and sends to auth', () => {
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session: null,
          profile: null,
          vendorCapability: null,
        }),
      ).toBe('/(auth)');
    });

    it('does not bounce an active session out of vendor tabs while capability is still loading (null)', () => {
      // Regression: previously `vendorCapability: null` (not-yet-loaded)
      // collapsed into `hasActiveVendor: false`, which redirected an
      // already-approved vendor sitting on /(vendor) out to /(client) the
      // instant the capability value momentarily read as unloaded (e.g.
      // right after app relaunch, before loadVendorCapability() resolves).
      // Once capability then loaded true, route-gate would redirect back
      // to /(vendor) — a ping-pong that tripped React's update-depth limit.
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: null,
        }),
      ).toBeNull();
    });

    it('does not bounce an active session out of vendor tabs while capability is still loading (undefined)', () => {
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: undefined,
        }),
      ).toBeNull();
    });

    it('still blocks vendor tabs once capability has loaded and is explicitly false', () => {
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(false),
        }),
      ).toBe('/(client)');
    });

    it('allows an approved-active vendor into vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(vendor)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBeNull();
    });

    it('redirects an approved-active vendor browsing client tabs into vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(client)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBe('/(vendor)');
    });

    it('redirects an approved-active vendor on welcome straight into vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(public)', 'welcome'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBe('/(vendor)');
    });

    it('redirects an approved-active vendor away from the application status page', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'vendor-onboarding', 'status'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBe('/(vendor)');
    });

    it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
      'allows an active vendor with %s status to stay on the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'status'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(true, status),
          }),
        ).toBeNull();
      },
    );

    it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
      'routes an active vendor with %s status from vendor tabs to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(vendor)'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(true, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it('redirects an approved-active vendor landing on plain auth routes into vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(auth)'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBe('/(vendor)');
    });

    it.each<VendorApplicationStatus>(['submitted', 'under_review'])(
      'routes a %s applicant from vendor tabs to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(vendor)'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it.each<VendorApplicationStatus>(['needs_more_info', 'rejected', 'suspended'])(
      'routes a %s applicant from vendor tabs to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(vendor)'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it.each<VendorApplicationStatus>(['needs_more_info', 'rejected', 'suspended'])(
      'routes a %s applicant inside vendor-onboarding to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'review'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it.each<VendorApplicationStatus>(['needs_more_info', 'rejected', 'suspended'])(
      'allows a %s applicant to stay on the status page itself',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'status'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBeNull();
      },
    );

    it.each<VendorApplicationStatus>(['submitted', 'under_review'])(
      'routes a %s applicant from the pending review flow to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'complete'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it('keeps guest browsing of (client) stable without vendor capability data', () => {
      expect(
        redirectFor({
          segments: ['(client)'],
          session: null,
          profile: null,
          vendorCapability: null,
          guestMode: false,
        }),
      ).toBe('/(auth)');
    });

    it('keeps guest browsing of (client) stable when guestMode is enabled', () => {
      expect(
        redirectFor({
          segments: ['(client)'],
          session: null,
          profile: null,
          vendorCapability: null,
          guestMode: true,
        }),
      ).toBeNull();
    });
  });

  describe('role route already-known-applicant guard', () => {
    it('keeps a brand-new user with no application on role selection', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'role'],
          session,
          profile: profile(),
          vendorCapability: capability(false),
        }),
      ).toBeNull();
    });

    it('keeps a brand-new user on role selection when vendorCapability has not loaded yet', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'role'],
          session,
          profile: profile(),
          vendorCapability: null,
        }),
      ).toBeNull();
    });

    it('still routes a new applicant tap-through to vendor setup ahead of the capability guard', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'role'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(false),
          postAuthPath: VENDOR_APPLICATION_PATH,
        }),
      ).toBe(VENDOR_APPLICATION_PATH);
    });

    it('sends an active vendor away from role selection into vendor tabs', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'role'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(true, 'approved'),
        }),
      ).toBe('/(vendor)');
    });

    it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
      'sends an active vendor with %s status from role selection to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'role'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(true, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it('resumes the onboarding wizard for a draft applicant landing on role selection', () => {
      expect(
        redirectFor({
          segments: ['(auth)', 'role'],
          session,
          profile: profile({ role: 'client' }),
          vendorCapability: capability(false, 'draft'),
        }),
      ).toBe('/(auth)/vendor-onboarding');
    });

    it.each<VendorApplicationStatus>(['submitted', 'under_review', 'needs_more_info', 'rejected', 'suspended'])(
      'sends a %s applicant away from role selection to the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'role'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe(VENDOR_APPLICATION_STATUS_PATH);
      },
    );

    it.each<VendorApplicationStatus>(['submitted', 'under_review'])(
      'allows a %s applicant to stay on the status page itself',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'status'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBeNull();
      },
    );

    it.each<VendorApplicationStatus | undefined>([undefined, 'draft', 'approved'])(
      'sends a client with %s application status away from the status page',
      (status) => {
        expect(
          redirectFor({
            segments: ['(auth)', 'vendor-onboarding', 'status'],
            session,
            profile: profile({ role: 'client' }),
            vendorCapability: capability(false, status),
          }),
        ).toBe('/(client)');
      },
    );
  });
});
