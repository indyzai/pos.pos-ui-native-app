export type ApiProfile = 'local' | 'production';
export function resolveMobileApiProfile(values: {
  environment?: string;
  posApiUrl?: string;
  posBaseUrl?: string;
  authApiUrl?: string;
}) {
  const environment: ApiProfile = values.environment === 'local' ? 'local' : 'production';
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
    posApiUrl: values.posApiUrl || defaults.posApiUrl,
    posBaseUrl: values.posBaseUrl || defaults.posBaseUrl,
    authApiUrl: values.authApiUrl || defaults.authApiUrl,
  };
}
