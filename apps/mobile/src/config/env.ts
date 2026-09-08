const development = typeof __DEV__ !== 'undefined' && __DEV__;

export const env = {
  posApiUrl:
    process.env.EXPO_PUBLIC_POS_API_URL ??
    (development ? 'http://localhost:3501/api/graphql' : 'https://api.indyzai.com/pos/api/graphql'),
  authAppId: process.env.EXPO_PUBLIC_AUTH_APP_ID,
  authApiUrl: process.env.EXPO_PUBLIC_AUTH_API_URL,
} as const;
