import { Platform } from 'react-native';
import { resolveMobileApiProfile, type ApiProfile } from './apiProfile';
export type ApiEnvironment = ApiProfile;

// Installed Android/iOS apps use production APIs even when Expo loads a local .env.
// Web keeps the selected profile and its configured URL overrides.
const profile = resolveMobileApiProfile({
  platform: Platform.OS,
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
