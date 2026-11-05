import { act, render, screen } from '@testing-library/react-native';

import StartupIndex from '@/app/index';
import { useAuthStore } from '@/store/useAuthStore';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>{`redirect:${href}`}</MockText>;
  },
}));

const session = { userId: 'user-1', email: 'u@example.com' };
const clientProfile = { id: 'user-1', email: 'u@example.com', fullName: 'User', role: 'client' as const };

const signedOut = { session: null, profile: null, vendorCapability: null, loading: false };

describe('cold start routing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthStore.setState(signedOut);
  });

  afterEach(() => jest.useRealTimers());

  it('returns a signed-in client to client discovery instead of Welcome', () => {
    useAuthStore.setState({ session, profile: clientProfile, vendorCapability: { hasActiveVendor: false } });
    render(<StartupIndex />);
    expect(screen.getByText('redirect:/(client)')).toBeTruthy();
  });

  it('sends guests to Welcome', () => {
    render(<StartupIndex />);
    expect(screen.getByText('redirect:/(public)/welcome')).toBeTruthy();
  });

  it('waits for vendor capability so a vendor never lands on the client tabs', () => {
    useAuthStore.setState({ session, profile: clientProfile, vendorCapability: null });
    render(<StartupIndex />);
    expect(screen.queryByText(/^redirect:/)).toBeNull();

    act(() => useAuthStore.setState({ vendorCapability: { hasActiveVendor: true } }));
    expect(screen.getByText('redirect:/(vendor)')).toBeTruthy();
  });

  it('holds guests only until the session check finishes', () => {
    useAuthStore.setState({ loading: true });
    render(<StartupIndex />);
    expect(screen.queryByText(/^redirect:/)).toBeNull();

    act(() => useAuthStore.setState({ loading: false }));
    expect(screen.getByText('redirect:/(public)/welcome')).toBeTruthy();
  });

  it.each([
    ['the session check', { loading: true }],
    ['the vendor capability check', { session, profile: clientProfile, vendorCapability: null }],
  ])('falls back to Welcome if %s never finishes', (_name, state) => {
    useAuthStore.setState(state);
    render(<StartupIndex />);
    expect(screen.queryByText(/^redirect:/)).toBeNull();

    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByText('redirect:/(public)/welcome')).toBeTruthy();
  });
});
