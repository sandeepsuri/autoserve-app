describe('isSupabaseConfigured', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('is true and supabase client is non-null when both env vars are set', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isSupabaseConfigured, supabase } = require('@/lib/supabase');
    expect(isSupabaseConfigured).toBe(true);
    expect(supabase).not.toBeNull();
  });

  it('is false and supabase is null when URL is missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isSupabaseConfigured, supabase } = require('@/lib/supabase');
    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });

  it('is false and supabase is null when anon key is missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isSupabaseConfigured, supabase } = require('@/lib/supabase');
    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });

  it('is false when both env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isSupabaseConfigured } = require('@/lib/supabase');
    expect(isSupabaseConfigured).toBe(false);
  });
});
