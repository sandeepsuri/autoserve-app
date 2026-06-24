import { getRouteGateRedirect, VENDOR_APPLICATION_PATH } from '@/lib/route-gate';
import type { UserProfile } from '@/types/domain';

const session = { userId: 'user-1', email: 'user@example.com' };

function profile(patch: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    ...patch,
  };
}

function redirectFor(input: Partial<Parameters<typeof getRouteGateRedirect>[0]>) {
  return getRouteGateRedirect({
    segments: ['(public)', 'welcome'],
    session: null,
    profile: null,
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
});
