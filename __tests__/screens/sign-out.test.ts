import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Alert, Platform } from 'react-native';

import ClientProfileScreen from '@/app/(client)/profile';
import VendorProfileScreen from '@/app/(vendor)/profile';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const { act, create } = jest.requireActual('react-test-renderer');
Object.assign(global, { IS_REACT_ACT_ENVIRONMENT: true });

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signOut: jest.fn() } },
}));

jest.mock('@/lib/vendor-payouts', () => ({
  getCurrentVendorPayoutStatus: jest.fn().mockResolvedValue({ stripeTransfersStatus: 'inactive' }),
  startVendorPayoutOnboarding: jest.fn(),
}));

const supabaseSignOut = supabase!.auth.signOut as jest.Mock;
const session = { userId: 'user-1', email: 'user@example.com' };

const roles = [
  { role: 'client' as const, Screen: ClientProfileScreen },
  { role: 'vendor' as const, Screen: VendorProfileScreen },
];

const cleanups: (() => void)[] = [];

async function renderScreen(Screen: React.ComponentType) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Screen)),
    );
  });
  cleanups.push(() => {
    tree.unmount();
    queryClient.clear();
  });
  return tree;
}

afterEach(async () => {
  await act(async () => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });
});

async function tapSignOut(tree: ReturnType<typeof create>) {
  await act(async () => {
    tree.root.findByProps({ label: 'Sign Out' }).props.onPress();
  });
}

function dialogButton(text: string) {
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => unknown }[];
  return buttons.find((button) => button.text === text)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  supabaseSignOut.mockResolvedValue({ error: null });
  useAuthStore.setState({
    session,
    profile: { id: 'user-1', email: session.email, fullName: 'User', role: 'client' },
    guestMode: false,
  });
});

describe.each(roles)('$role Sign Out', ({ Screen }) => {
  it('asks for confirmation instead of ending the session on tap', async () => {
    const tree = await renderScreen(Screen);

    await tapSignOut(tree);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Sign out?');
    expect(dialogButton('Cancel')).toMatchObject({ style: 'cancel' });
    expect(dialogButton('Sign Out')).toMatchObject({ style: 'destructive' });
    expect(supabaseSignOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(session);
  });

  it('Cancel keeps the session and the current screen', async () => {
    const tree = await renderScreen(Screen);
    await tapSignOut(tree);

    await act(async () => {
      dialogButton('Cancel').onPress?.();
    });

    expect(supabaseSignOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(session);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ label: 'Sign Out' }).props.disabled).toBeFalsy();
  });

  it('Confirm ends the session and routes to auth', async () => {
    const tree = await renderScreen(Screen);
    await tapSignOut(tree);

    await act(async () => {
      await dialogButton('Sign Out').onPress?.();
    });

    expect(supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });

  it('disables the button while signing out', async () => {
    let finishSignOut!: (value: { error: null }) => void;
    supabaseSignOut.mockReturnValue(new Promise((resolve) => { finishSignOut = resolve; }));
    const tree = await renderScreen(Screen);
    await tapSignOut(tree);

    await act(async () => {
      dialogButton('Sign Out').onPress?.();
    });
    expect(tree.root.findByProps({ label: 'Signing out...' }).props.disabled).toBe(true);

    await act(async () => {
      finishSignOut({ error: null });
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('stays put and reports the problem when sign-out fails', async () => {
    supabaseSignOut.mockRejectedValue(new Error('Network down'));
    const tree = await renderScreen(Screen);
    await tapSignOut(tree);

    await act(async () => {
      await dialogButton('Sign Out').onPress?.();
    });

    expect(Alert.alert).toHaveBeenLastCalledWith('Could not sign out', 'Network down');
    expect(useAuthStore.getState().session).toEqual(session);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ label: 'Sign Out' }).props.disabled).toBe(false);
  });
});

describe('client without a session', () => {
  it('does not offer Sign Out to guests', async () => {
    useAuthStore.setState({ session: null, profile: null, guestMode: true });

    const tree = await renderScreen(ClientProfileScreen);

    expect(tree.root.findAllByProps({ label: 'Sign Out' })).toHaveLength(0);
  });
});

describe('Sign Out on web, where Alert.alert is a no-op', () => {
  const originalOS = Platform.OS;
  const confirm = jest.fn();

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.assign(window, { confirm });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('Cancel keeps the session', async () => {
    confirm.mockReturnValue(false);
    const tree = await renderScreen(ClientProfileScreen);

    await tapSignOut(tree);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(supabaseSignOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(session);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Confirm ends the session and routes to auth', async () => {
    confirm.mockReturnValue(true);
    const tree = await renderScreen(ClientProfileScreen);

    await tapSignOut(tree);

    expect(useAuthStore.getState().session).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });
});
