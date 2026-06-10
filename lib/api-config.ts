// In dev (Expo Go / local Metro), fall back to localhost so vehicle catalog fetches still work.
// In production/preview builds, the env var MUST be set in EAS → environment variables for the
// relevant profile (preview/production). A missing var in a release build will produce empty
// strings and surface a clear network error instead of silently hitting localhost.
const devFallback = __DEV__ ? 'http://localhost:3000' : '';
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? devFallback;
