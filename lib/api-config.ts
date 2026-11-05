import { resolveApiBaseUrl } from './api-url';

// Resolve at request time so configuration errors appear in the selector's error state.
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, !__DEV__);
}
