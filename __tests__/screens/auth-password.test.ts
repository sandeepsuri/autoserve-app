import React from 'react';

import AuthScreen from '@/app/(auth)/index';

const { act, create } = jest.requireActual('react-test-renderer');
Object.assign(global, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signOut: jest.fn() } },
}));

const trees: ReturnType<typeof create>[] = [];

async function renderAuthScreen() {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(React.createElement(AuthScreen));
  });
  trees.push(tree);
  return tree;
}

afterEach(async () => {
  await act(async () => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
});

function passwordInput(tree: ReturnType<typeof create>) {
  return tree.root.findByProps({ placeholder: 'Password' });
}

async function press(tree: ReturnType<typeof create>, accessibilityLabel: string) {
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel }).props.onPress();
  });
}

describe('login password visibility', () => {
  it('hides the password by default and offers an accessible show control', async () => {
    const tree = await renderAuthScreen();

    expect(passwordInput(tree).props.secureTextEntry).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Show password' }).props.accessibilityRole).toBe('button');
  });

  it('toggles visibility both ways and keeps what was typed', async () => {
    const tree = await renderAuthScreen();
    await act(async () => {
      passwordInput(tree).props.onChangeText('secret-pass');
    });

    await press(tree, 'Show password');
    expect(passwordInput(tree).props.secureTextEntry).toBe(false);
    expect(passwordInput(tree).props.value).toBe('secret-pass');
    expect(tree.root.findByProps({ accessibilityLabel: 'Hide password' }).props.accessibilityRole).toBe('button');

    await press(tree, 'Hide password');
    expect(passwordInput(tree).props.secureTextEntry).toBe(true);
    expect(passwordInput(tree).props.value).toBe('secret-pass');
  });

  it('does not let the keyboard alter a revealed password', async () => {
    const tree = await renderAuthScreen();
    await press(tree, 'Show password');

    expect(passwordInput(tree).props.autoCapitalize).toBe('none');
    expect(passwordInput(tree).props.autoCorrect).toBe(false);
  });

  it('hides the password again when switching between log in and sign up', async () => {
    const tree = await renderAuthScreen();
    await press(tree, 'Show password');

    await act(async () => {
      tree.root.findByProps({ label: 'Sign Up' }).props.onPress();
    });

    expect(passwordInput(tree).props.secureTextEntry).toBe(true);
  });
});
