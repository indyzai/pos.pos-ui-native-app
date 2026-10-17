import { resolveMobileApiProfile, type ApiProfile } from './apiProfile';
export type ApiEnvironment = ApiProfile;

// Expo inlines these public values from .env. The selected profile takes precedence
// over previously saved device preferences on native and web alike.
const profile = resolveMobileApiProfile({
  environment: process.env.EXPO_PUBLIC_API_ENVIRONMENT,
  posApiUrl: process.env.EXPO_PUBLIC_POS_API_URL,
  posBaseUrl: process.env.EXPO_PUBLIC_POS_BASE_URL,
  authApiUrl: process.env.EXPO_PUBLIC_AUTH_API_URL,
});
export const canSwitchApiEnvironment = false;
export const getApiEnvironment = async (): Promise<ApiEnvironment> => profile.environment;
export const getRuntimeApiUrls = async () => ({ ...profile });
export async function setApiEnvironment(value: ApiEnvironment): Promise<void> {
  if (value !== profile.environment) {
    throw new Error('Select env:local or env:production and restart Expo to switch APIs.');
  }
}
