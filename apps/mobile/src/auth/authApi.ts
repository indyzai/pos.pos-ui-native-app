import { createAuthApi } from '@indyzai/pos-auth/api';
import { env } from '../config/env';
import { getRuntimeApiUrls } from '../config/runtimeEnvironment';

export const authApi = createAuthApi({
  application: 'pos',
  appId: env.authAppId ?? 'pos-app',
  callbackScheme: 'indyzai-pos',
  getRuntimeApiUrls,
});

export type {
  AuthTenant,
  AuthUser,
  DeviceRegistrationDetails,
  LoginCredentials,
  RegistrationPayload,
} from '@indyzai/pos-auth';
