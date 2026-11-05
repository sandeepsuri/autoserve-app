/**
 * Shared by Expo build configuration (Node) and the runtime catalog client.
 * @param {string | undefined} value
 * @param {boolean} release
 * @returns {string}
 */
function resolveApiBaseUrl(value, release) {
  const configured = value?.trim();
  if (!configured && release) {
    throw new Error('Vehicle catalog is not configured. Set EXPO_PUBLIC_API_BASE_URL in the EAS environment and rebuild the app.');
  }

  const base = configured || 'http://localhost:3000';
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL. Update the app configuration and rebuild.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) URL without credentials, query parameters, or a fragment.');
  }
  const host = url.hostname.toLowerCase();
  if (release && (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '0.0.0.0' || host.startsWith('127.'))) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL cannot use localhost or a loopback address in preview or production. Set the deployed API URL and rebuild.');
  }
  return url.toString().replace(/\/+$/, '');
}

module.exports = { resolveApiBaseUrl };
