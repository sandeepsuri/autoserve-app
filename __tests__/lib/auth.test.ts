jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: {
    getState: jest.fn(() => ({
      vendors: [],
      profiles: [],
      services: [],
      addOrUpdateProfile: jest.fn(),
    })),
  },
  demoReviewsState: [],
}));

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      getSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { signIn, signUp, signOut, setRole } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';

const auth = supabase!.auth as jest.Mocked<typeof supabase.auth>;
const mockFrom = supabase!.from as jest.Mock;
const mockGetState = useAuthStore.getState as jest.Mock;
const mockSetSessionData = jest.fn();
const mockClearAuth = jest.fn();

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSession = { access_token: 'token', user: mockUser };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetState.mockReturnValue({
    session: null,
    profile: null,
    setSessionData: mockSetSessionData,
    clearAuth: mockClearAuth,
  });
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  });
});

// ─── signUp ──────────────────────────────────────────────────────────────────

describe('signUp', () => {
  it('returns needsConfirmation: true when Supabase returns no session', async () => {
    (auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });

    const result = await signUp('test@example.com', 'password123', 'Test User');

    expect(result.needsConfirmation).toBe(true);
    expect(result.session).toBeNull();
    expect(mockSetSessionData).not.toHaveBeenCalled();
  });

  it('returns needsConfirmation: false and sets session when Supabase returns a session', async () => {
    (auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const result = await signUp('test@example.com', 'password123', 'Test User');

    expect(result.needsConfirmation).toBe(false);
    expect(result.session).toEqual({ userId: 'user-123', email: 'test@example.com' });
    expect(mockSetSessionData).toHaveBeenCalledTimes(1);
  });

  it('throws when Supabase returns an error', async () => {
    (auth.signUp as jest.Mock).mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    });

    await expect(signUp('test@example.com', 'password123', 'Test User')).rejects.toMatchObject({
      message: 'User already registered',
    });
    expect(mockSetSessionData).not.toHaveBeenCalled();
  });
});

// ─── signIn ──────────────────────────────────────────────────────────────────

describe('signIn', () => {
  it('returns session and calls setSessionData on success', async () => {
    (auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const result = await signIn('test@example.com', 'password123');

    expect(result.session).toEqual({ userId: 'user-123', email: 'test@example.com' });
    expect(mockSetSessionData).toHaveBeenCalledTimes(1);
  });

  it('throws when Supabase returns an error', async () => {
    (auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });

    await expect(signIn('test@example.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid login credentials',
    });
  });
});

// ─── setRole ─────────────────────────────────────────────────────────────────

describe('setRole', () => {
  it('throws "No active session" when the store has no session', async () => {
    mockGetState.mockReturnValue({ session: null, profile: null });

    await expect(setRole('client')).rejects.toThrow('No active session');
  });

  it('persists the new role and calls setSessionData when session exists', async () => {
    mockGetState.mockReturnValue({
      session: { userId: 'user-123', email: 'test@example.com' },
      profile: { id: 'user-123', email: 'test@example.com', fullName: 'Test User' },
      setSessionData: mockSetSessionData,
    });

    await setRole('client');

    expect(mockSetSessionData).toHaveBeenCalledWith(
      { userId: 'user-123', email: 'test@example.com' },
      expect.objectContaining({ role: 'client' }),
    );
  });

  it('sets businessType for vendor role', async () => {
    mockGetState.mockReturnValue({
      session: { userId: 'user-123', email: 'test@example.com' },
      profile: null,
      setSessionData: mockSetSessionData,
    });

    await setRole('vendor', 'shop');

    expect(mockSetSessionData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'vendor', businessType: 'shop' }),
    );
  });
});

// ─── signOut ─────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('calls supabase.auth.signOut and clears the store', async () => {
    (auth.signOut as jest.Mock).mockResolvedValue({ error: null });
    mockGetState.mockReturnValue({ clearAuth: mockClearAuth });

    await signOut();

    expect(auth.signOut).toHaveBeenCalled();
    expect(mockClearAuth).toHaveBeenCalled();
  });
});
