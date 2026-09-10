const development = typeof __DEV__ !== 'undefined' && __DEV__;

export function resolveAuthApiUrl(expoGoLinkingUri?: string): string {
  if (process.env.EXPO_PUBLIC_AUTH_API_URL) return process.env.EXPO_PUBLIC_AUTH_API_URL;
  if (!development) return 'https://api.indyzai.com/auth/api/v1';
  if (expoGoLinkingUri) {
    try {
      const host = new URL(expoGoLinkingUri).hostname;
      if (host) return `http://${host}:3504/api/v1`;
    } catch {
      // Fall through to localhost when Expo did not provide a valid linking URI.
    }
  }
  return 'http://localhost:3504/api/v1';
}

export const env = {
  posApiUrl:
    process.env.EXPO_PUBLIC_POS_API_URL ??
    (development ? 'http://localhost:3501/api/graphql' : 'https://api.indyzai.com/pos/api/graphql'),
  authApiUrl: resolveAuthApiUrl(),
  authAppId: process.env.EXPO_PUBLIC_AUTH_APP_ID,
} as const;
