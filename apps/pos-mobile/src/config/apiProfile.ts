export type ApiProfile = 'local' | 'production';
export function resolveMobileApiProfile(values: {
  platform?: string;
  environment?: string;
  posApiUrl?: string;
  posBaseUrl?: string;
  authApiUrl?: string;
}) {
  const native = values.platform === 'android' || values.platform === 'ios';
  const environment: ApiProfile = !native && values.environment === 'local' ? 'local' : 'production';
  const defaults =
    environment === 'local'
      ? {
          posApiUrl: 'http://localhost:3501/api/graphql',
          posBaseUrl: 'http://localhost:3501/api',
          authApiUrl: 'http://localhost:3504/api/v1',
        }
      : {
          posApiUrl: 'https://api.indyzai.com/pos/api/graphql',
          posBaseUrl: 'https://api.indyzai.com/pos/api',
          authApiUrl: 'https://api.indyzai.com/auth/api/v1',
        };
  return {
    environment,
    posApiUrl: (!native && values.posApiUrl) || defaults.posApiUrl,
    posBaseUrl: (!native && values.posBaseUrl) || defaults.posBaseUrl,
    authApiUrl: (!native && values.authApiUrl) || defaults.authApiUrl,
  };
}
