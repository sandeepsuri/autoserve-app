import { ConfigContext, ExpoConfig } from 'expo/config';

import { resolveApiBaseUrl } from './lib/api-url';

export default ({ config }: ConfigContext): ExpoConfig => {
  const release = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE ?? '') || process.env.NODE_ENV === 'production';
  resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, release);
  return ({
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
        },
      },
    },
  } as ExpoConfig);
};
