import { resolveApiBaseUrl } from '@/lib/api-url';
import configureApp from '../../app.config';
import eas from '../../eas.json';

const originalEnv = { ...process.env };
afterEach(() => { for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv); });

describe('release API URL contract', () => {
  it.each([undefined, '', '   '])('rejects missing release configuration: %p', (value) => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow('EXPO_PUBLIC_API_BASE_URL');
  });

  it.each(['http://localhost:3000', 'http://api.localhost', 'http://127.0.0.1', 'http://127.2.3.4', 'http://[::1]:3000', 'http://0.0.0.0'])('rejects local release URLs: %s', (value) => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow(/localhost|loopback/);
  });

  it.each(['/api', 'invalid', 'ftp://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com?x=1'])('rejects invalid base URLs: %s', (value) => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow('EXPO_PUBLIC_API_BASE_URL');
  });

  it('normalizes a configured URL and allows an explicit development fallback', () => {
    expect(resolveApiBaseUrl(' https://preview-api.example.com/backend/ ', true)).toBe('https://preview-api.example.com/backend');
    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:3000');
  });

  it.each(['preview', 'production'])('fails the %s build before bundling without a deployed URL', (profile) => {
    process.env.EAS_BUILD_PROFILE = profile;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    const context = { config: { name: 'AutoServe', slug: 'autoserve' } } as Parameters<typeof configureApp>[0];
    expect(() => configureApp(context)).toThrow('EXPO_PUBLIC_API_BASE_URL');
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    expect(() => configureApp(context)).toThrow('localhost');
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com';
    expect(configureApp(context).slug).toBe('autoserve');
    expect(eas.build[profile as 'preview' | 'production'].environment).toBe(profile);
  });
});
