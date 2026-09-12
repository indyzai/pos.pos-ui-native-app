import { createAuthApi } from '@indyzai/pos-auth/api';
import { env } from '../config/env';
import { getRuntimeApiUrls } from '../config/runtimeEnvironment';

export const authApi = createAuthApi({
    application: 'admin',
    appId: env.authAppId ?? 'pos-admin-app',
    callbackScheme: 'indyzai-pos-admin',
    getRuntimeApiUrls,
});

export type {
    AuthTenant,
    AuthUser,
    DeviceRegistrationDetails,
    LoginCredentials,
    RegistrationPayload,
} from '@indyzai/pos-auth';
