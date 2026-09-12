import { requestJson } from '../../core/api/baseApi';
import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { env } from '../../config/env';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';
import type {
    AuthTenant,
    AuthUser,
    DeviceRegistrationDetails,
    LoginCredentials,
    RegistrationPayload,
} from '@indyzai/pos-auth';
export type {
    AuthTenant,
    AuthUser,
    DeviceRegistrationDetails,
    LoginCredentials,
    RegistrationPayload,
} from '@indyzai/pos-auth';

WebBrowser.maybeCompleteAuthSession();

const authAppId = env.authAppId ?? (Platform.OS === 'web' ? 'pos' : 'pos-app');
const accessTokenKey = 'indyzai.access-token';
const refreshTokenKey = 'indyzai.refresh-token';
const userKey = 'indyzai.user';
const selectedTenantKey = 'indyzai.selected-tenant';
const deviceIdKey = 'indyzai.device-id';
const deviceTokenKey = 'indyzai.device-token';
const oauthStateKey = 'indyzai.oauth-state';
const oauthVerifierKey = 'indyzai.oauth-verifier';
const sessionFallback = new Map<string, string>();
let sessionUserPromise: Promise<AuthUser | null> | undefined;
let authorizationCompletion: Promise<void> | undefined;

type Tokens = { accessToken?: string; refreshToken?: string; user?: AuthUser };
type AuthResponse = Tokens & { tokens?: Tokens; user?: AuthUser };
type CodeResponse = AuthResponse & { code?: string; applicationCode?: string };

async function canUseBiometricAuthentication(): Promise<boolean> {
    if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
        return false;
    try {
        return (
            (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
        );
    } catch {
        return false;
    }
}

async function getDeviceToken(): Promise<string | null> {
    const requireAuthentication = await canUseBiometricAuthentication();
    return SecureStore.getItemAsync(
        deviceTokenKey,
        requireAuthentication ? { requireAuthentication: true } : undefined,
    );
}

async function setDeviceToken(value: string): Promise<void> {
    const requireAuthentication = await canUseBiometricAuthentication();
    await SecureStore.setItemAsync(
        deviceTokenKey,
        value,
        requireAuthentication ? { requireAuthentication: true } : undefined,
    );
}

async function authenticateDeviceIfAvailable(promptMessage: string): Promise<void> {
    if (!(await canUseBiometricAuthentication())) return;
    const verified = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback: false,
    });
    if (!verified.success) throw new Error('Device authentication was not completed.');
}

async function fetchCurrentUser(accessToken: string): Promise<AuthUser> {
    const { authApiUrl: runtimeAuthApiUrl } = await getRuntimeApiUrls();
    const body = await requestJson<AuthUser & { user?: AuthUser }>(`${runtimeAuthApiUrl}/users/me`, {
        token: accessToken,
    });
    const user = body.user ?? body;
    if (!user.id) throw new Error('Your sign-in did not include a user profile.');
    return user;
}

async function setSessionValue(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
    }

    try {
        await SecureStore.setItemAsync(key, value);
    } catch {
        // An out-of-date Expo Go client can lack the SecureStore native method.
        // Keep the session usable for this run without writing tokens insecurely.
        sessionFallback.set(key, value);
    }
}

async function getSessionValue(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;

    try {
        return await SecureStore.getItemAsync(key);
    } catch {
        return sessionFallback.get(key) ?? null;
    }
}

async function deleteSessionValue(key: string): Promise<void> {
    if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
    }

    sessionFallback.delete(key);
    try {
        await SecureStore.deleteItemAsync(key);
    } catch {
        // See the Expo Go fallback in setSessionValue.
    }
}

async function request<T>(path: string, body: Record<string, string> = {}): Promise<T> {
    const { authApiUrl: runtimeAuthApiUrl } = await getRuntimeApiUrls();
    return requestJson<T>(runtimeAuthApiUrl + path, { method: 'POST', body });
}

async function authenticatedRequest<T>(
    path: string,
    body: Record<string, string>,
    accessToken: string,
): Promise<T> {
    const { authApiUrl: runtimeAuthApiUrl } = await getRuntimeApiUrls();
    return requestJson<T>(runtimeAuthApiUrl + path, { method: 'POST', body, token: accessToken });
}

async function getDeviceIdentifier(): Promise<string> {
    if (Platform.OS === 'android') {
        const identifier = Application.getAndroidId();
        if (identifier) return `android:${identifier}`;
    }
    if (Platform.OS === 'ios') {
        const identifier = await Application.getIosIdForVendorAsync();
        if (identifier) return `ios:${identifier}`;
    }
    throw new Error('Device authentication is available only in the installed mobile app.');
}

async function saveSession(response: AuthResponse): Promise<void> {
    const tokens = response.tokens ?? response;
    if (!tokens.accessToken || !tokens.refreshToken)
        throw new Error('The authentication service did not return a complete session.');
    // The auth service can return the profile either beside tokens or inside
    // the tokens object (the contract used by pos.pos-ui-new).
    const user = response.user ?? tokens.user ?? (await fetchCurrentUser(tokens.accessToken));
    const selectedTenantId = await getSessionValue(selectedTenantKey);
    const selectedTenant =
        user.tenants?.find((tenant) => tenant.id === selectedTenantId) ?? user.tenants?.[0];
    await Promise.all([
        setSessionValue(accessTokenKey, tokens.accessToken),
        setSessionValue(refreshTokenKey, tokens.refreshToken),
        setSessionValue(userKey, JSON.stringify(user)),
        selectedTenant
            ? setSessionValue(selectedTenantKey, selectedTenant.id)
            : deleteSessionValue(selectedTenantKey),
    ]);
}

async function hydrateSessionUser(): Promise<AuthUser | null> {
    const user = await authApi.getStoredUser();
    if (user?.tenants?.length) return user;
    const accessToken = await getSessionValue(accessTokenKey);
    if (!accessToken) return user;
    let hydratedUser: AuthUser;
    try {
        hydratedUser = await fetchCurrentUser(accessToken);
    } catch (error) {
        if (!user) throw error;
        return user;
    }
    const selectedTenantId = await getSessionValue(selectedTenantKey);
    const selectedTenant =
        hydratedUser.tenants?.find((tenant) => tenant.id === selectedTenantId) ?? hydratedUser.tenants?.[0];
    await Promise.all([
        setSessionValue(userKey, JSON.stringify(hydratedUser)),
        selectedTenant
            ? setSessionValue(selectedTenantKey, selectedTenant.id)
            : deleteSessionValue(selectedTenantKey),
    ]);
    return hydratedUser;
}

/** Coalesces concurrent billing/header requests while a token-only session is hydrated. */
async function getSessionUser(): Promise<AuthUser | null> {
    if (!sessionUserPromise) {
        sessionUserPromise = hydrateSessionUser().finally(() => {
            sessionUserPromise = undefined;
        });
    }
    return sessionUserPromise;
}

async function exchangeCode(code: string, applicationCode = false, codeVerifier?: string): Promise<void> {
    const result = await request<AuthResponse>(
        applicationCode ? '/auth/app/success' : '/auth/success',
        applicationCode && codeVerifier ? { code, codeVerifier } : { code },
    );
    await saveSession(result);
}

async function completeAuthorizationCode(code: string, returnedState?: string): Promise<void> {
    if (authorizationCompletion) return authorizationCompletion;
    authorizationCompletion = (async () => {
        const [expectedState, codeVerifier] = await Promise.all([
            getSessionValue(oauthStateKey),
            getSessionValue(oauthVerifierKey),
        ]);
        if (expectedState && returnedState !== expectedState) {
            throw new Error('The sign-in response could not be verified. Please try again.');
        }
        if (!codeVerifier) {
            if (await getSessionValue(accessTokenKey)) return;
            throw new Error('The sign-in request expired. Please start again.');
        }
        await exchangeCode(code, true, codeVerifier);
    })();
    try {
        await authorizationCompletion;
    } finally {
        await Promise.all([deleteSessionValue(oauthStateKey), deleteSessionValue(oauthVerifierKey)]);
        authorizationCompletion = undefined;
    }
}

export const authApi = {
    getAccessToken: () => getSessionValue(accessTokenKey),
    completeAuthorizationCode,
    async getDeviceRegistrationDetails(): Promise<DeviceRegistrationDetails> {
        const deviceId = await getSessionValue(deviceIdKey);
        let deviceIdentifier: string | undefined;
        if (Platform.OS !== 'web') {
            try {
                deviceIdentifier = await getDeviceIdentifier();
            } catch {
                deviceIdentifier = undefined;
            }
        }
        return {
            registered: Boolean(deviceId),
            deviceId: deviceId || undefined,
            deviceIdentifier,
            deviceName:
                Constants.deviceName || (Platform.OS === 'web' ? 'Web browser' : 'IndyzAI POS device'),
            platform: Platform.OS,
            platformVersion: String(Platform.Version),
            applicationId: Application.applicationId || (Platform.OS === 'web' ? authAppId : 'Unavailable'),
            applicationVersion:
                Application.nativeApplicationVersion || Constants.expoConfig?.version || 'Unavailable',
            buildVersion: Application.nativeBuildVersion || 'Development',
            executionEnvironment: String(Constants.executionEnvironment || 'standalone'),
        };
    },
    async hasRegisteredDevice(): Promise<boolean> {
        if (Platform.OS === 'web') return false;
        try {
            return Boolean(await getSessionValue(deviceIdKey));
        } catch {
            return false;
        }
    },
    async getStoredUser(): Promise<AuthUser | null> {
        const serializedUser = await getSessionValue(userKey);
        if (!serializedUser) return null;
        try {
            return JSON.parse(serializedUser) as AuthUser;
        } catch {
            await deleteSessionValue(userKey);
            return null;
        }
    },
    getSessionUser,
    async getSelectedTenant(profile?: AuthUser | null): Promise<AuthTenant | null> {
        const user = profile ?? (await this.getStoredUser());
        const tenants = user?.tenants ?? [];
        if (!tenants.length) return null;
        const selectedTenantId = await getSessionValue(selectedTenantKey);
        return tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];
    },
    async selectTenant(tenantId: string): Promise<AuthTenant> {
        const user = await this.getStoredUser();
        const tenant = user?.tenants?.find((item) => item.id === tenantId);
        if (!tenant) throw new Error('That business is no longer available for this account.');
        await setSessionValue(selectedTenantKey, tenant.id);
        return tenant;
    },
    async logout(): Promise<void> {
        await Promise.all([
            deleteSessionValue(accessTokenKey),
            deleteSessionValue(refreshTokenKey),
            deleteSessionValue(userKey),
            deleteSessionValue(selectedTenantKey),
        ]);
    },
    async registerDevice(pin: string): Promise<void> {
        if (Platform.OS === 'web') throw new Error('Device authentication is disabled on web.');
        if (!/^\d{4,8}$/.test(pin)) throw new Error('Choose a 4 to 8 digit device PIN.');
        const accessToken = await getSessionValue(accessTokenKey);
        if (!accessToken) throw new Error('Sign in before registering this device.');
        const deviceIdentifier = await getDeviceIdentifier();
        const tenant = await this.getSelectedTenant();
        const result = await authenticatedRequest<{ deviceId: string; deviceToken: string }>(
            '/device/register',
            {
                deviceIdentifier,
                pin,
                name: Constants.deviceName || 'IndyzAI POS device',
                tenantId: tenant?.id || '',
            },
            accessToken,
        );
        try {
            await Promise.all([
                setSessionValue(deviceIdKey, result.deviceId),
                setDeviceToken(result.deviceToken),
            ]);
        } catch (error) {
            await Promise.all([
                deleteSessionValue(deviceIdKey),
                SecureStore.deleteItemAsync(deviceTokenKey).catch(() => undefined),
            ]);
            throw error;
        }
    },
    async authenticateWithDevice(): Promise<void> {
        if (Platform.OS === 'web')
            throw new Error(
                'Device authentication is disabled on web. Sign in with your password or Google/Microsoft.',
            );
        const [deviceId, deviceToken] = await Promise.all([getSessionValue(deviceIdKey), getDeviceToken()]);
        if (!deviceId || !deviceToken)
            throw new Error('Set up device access after signing in with your password.');
        await authenticateDeviceIfAvailable('Unlock IndyzAI POS');
        const result = await request<{ user: AuthUser; tokens: Tokens; deviceToken: string }>(
            '/device/token',
            {
                deviceId,
                deviceToken,
            },
        );
        if (!result.tokens.accessToken) throw new Error('The device did not return a valid session.');
        const selectedTenantId = await getSessionValue(selectedTenantKey);
        const selectedTenant =
            result.user.tenants?.find((tenant) => tenant.id === selectedTenantId) ?? result.user.tenants?.[0];
        await Promise.all([
            setSessionValue(accessTokenKey, result.tokens.accessToken),
            setSessionValue(userKey, JSON.stringify(result.user)),
            selectedTenant
                ? setSessionValue(selectedTenantKey, selectedTenant.id)
                : deleteSessionValue(selectedTenantKey),
            setDeviceToken(result.deviceToken),
        ]);
    },
    async changeDevicePin(pin: string): Promise<void> {
        if (Platform.OS === 'web') throw new Error('Device authentication is disabled on web.');
        await this.verifyDeviceAccess();
        await this.registerDevice(pin);
    },
    async verifyDeviceAccess(): Promise<void> {
        if (Platform.OS === 'web') throw new Error('Device authentication is disabled on web.');
        await authenticateDeviceIfAvailable('Verify device access');
    },
    async login({ email, password }: LoginCredentials) {
        const result = await request<CodeResponse>('/auth/login', {
            email,
            password,
            appId: authAppId,
            env: 'prod',
        });
        const tokens = result.tokens ?? result;
        if (tokens.accessToken && tokens.refreshToken) return saveSession(result);
        if (!result.code) throw new Error('The authentication service did not return a login code.');
        return exchangeCode(result.code);
    },
    async register(payload: RegistrationPayload) {
        const result = await request<AuthResponse>('/auth/register', payload);
        return saveSession(result);
    },
    async authorize(provider: 'google' | 'microsoft') {
        const { authApiUrl: runtimeAuthApiUrl } = await getRuntimeApiUrls();
        const redirectUri = AuthSession.makeRedirectUri(
            Platform.OS === 'web'
                ? { path: 'auth/callback' }
                : { scheme: 'indyzai-pos', path: 'auth/callback' },
        );
        const state = new AuthSession.AuthRequest({
            clientId: authAppId,
            redirectUri,
            usePKCE: false,
        }).state;
        // Preserve AuthSession's CSRF state in the callback itself as well as in
        // the server-side OAuth state. This keeps the popup flow valid through
        // browser-based auth UI handoffs.
        const callback = new URL(redirectUri);
        callback.searchParams.set('state', state);
        const request = new AuthSession.AuthRequest({
            clientId: authAppId,
            redirectUri: callback.toString(),
            responseType: AuthSession.ResponseType.Code,
            usePKCE: true,
            state,
            extraParams: { appName: authAppId, redirect: callback.toString() },
        });
        const discovery = { authorizationEndpoint: `${runtimeAuthApiUrl}/auth/${provider}` };
        // PKCE values are generated when Expo prepares the authorization URL.
        // Prepare it explicitly so the verifier can be persisted before Android
        // leaves the app and potentially recreates the callback activity.
        await request.makeAuthUrlAsync(discovery);
        if (!request.codeVerifier) throw new Error('Sign-in could not create a secure verification code.');
        await Promise.all([
            setSessionValue(oauthStateKey, state),
            setSessionValue(oauthVerifierKey, request.codeVerifier),
        ]);
        const result = await request.promptAsync(discovery);
        if (result.type === 'cancel' || result.type === 'dismiss') {
            await Promise.all([deleteSessionValue(oauthStateKey), deleteSessionValue(oauthVerifierKey)]);
            return false;
        }
        if (result.type !== 'success')
            throw new Error(`${provider === 'google' ? 'Google' : 'Microsoft'} sign-in did not complete.`);
        const code = new URL(result.url).searchParams.get('code');
        if (!code) throw new Error('The authentication callback did not include a code.');
        await completeAuthorizationCode(code, new URL(result.url).searchParams.get('state') || undefined);
        return true;
    },
};
