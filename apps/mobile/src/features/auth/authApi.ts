import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

function getExpoGoAuthApiUrl(): string | undefined {
  if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) return undefined;

  try {
    // Expo Go's linking URI contains the Metro host, e.g.
    // exp://192.168.1.2:3511. The physical device must use that host to
    // reach the auth API running on the development machine.
    const host = new URL(Constants.linkingUri).hostname;
    return host ? `http://${host}:3504/api/v1` : undefined;
  } catch {
    return undefined;
  }
}

const baseUrl =
  process.env.EXPO_PUBLIC_AUTH_API_URL ??
  (!__DEV__
    ? (getExpoGoAuthApiUrl() ?? 'http://localhost:3504/api/v1')
    : 'https://api.indyzai.com/auth/api/v1');
const appId = process.env.EXPO_PUBLIC_AUTH_APP_ID ?? (Platform.OS === 'web' ? 'pos' : 'pos-app');
const accessTokenKey = 'indyzai.access-token';
const refreshTokenKey = 'indyzai.refresh-token';
const userKey = 'indyzai.user';
const selectedTenantKey = 'indyzai.selected-tenant';
const deviceIdKey = 'indyzai.device-id';
const deviceTokenKey = 'indyzai.device-token';
const sessionFallback = new Map<string, string>();
const deviceTokenOptions =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? undefined
    : { requireAuthentication: true };

type Tokens = { accessToken?: string; refreshToken?: string };
export type AuthTenant = { id: string; name: string; role: string };
export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role?: string;
  tenants?: AuthTenant[];
};
type AuthResponse = Tokens & { tokens?: Tokens; user?: AuthUser };
type CodeResponse = AuthResponse & { code?: string; applicationCode?: string };

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
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string | string[] } & T;
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Authentication request failed',
    );
  return data;
}

async function authenticatedRequest<T>(
  path: string,
  body: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string | string[] } & T;
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Device request failed',
    );
  return data;
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
  const writes: Promise<void>[] = [
    setSessionValue(accessTokenKey, tokens.accessToken),
    setSessionValue(refreshTokenKey, tokens.refreshToken),
  ];
  writes.push(
    response.user ? setSessionValue(userKey, JSON.stringify(response.user)) : deleteSessionValue(userKey),
  );
  writes.push(deleteSessionValue(selectedTenantKey));
  await Promise.all(writes);
}

async function exchangeCode(code: string, applicationCode = false, codeVerifier?: string): Promise<void> {
  const result = await request<AuthResponse>(
    applicationCode ? '/auth/app/success' : '/auth/success',
    applicationCode && codeVerifier ? { code, codeVerifier } : { code },
  );
  await saveSession(result);
}

export type LoginCredentials = { email: string; password: string };
export type RegistrationPayload = {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
  domainName: string;
  organizationType: string;
  industry: string;
};

export const authApi = {
  async hasRegisteredDevice(): Promise<boolean> {
    try {
      const [deviceId, deviceToken] = await Promise.all([
        getSessionValue(deviceIdKey),
        SecureStore.getItemAsync(deviceTokenKey, deviceTokenOptions),
      ]);
      return Boolean(deviceId && deviceToken);
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
  async getSelectedTenant(): Promise<AuthTenant | null> {
    const user = await this.getStoredUser();
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
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Choose a 4 to 8 digit device PIN.');
    const accessToken = await getSessionValue(accessTokenKey);
    if (!accessToken) throw new Error('Sign in before registering this device.');
    const deviceIdentifier = await getDeviceIdentifier();
    const tenant = await this.getSelectedTenant();
    const result = await authenticatedRequest<{ deviceId: string; deviceToken: string }>(
      '/device/register',
      { deviceIdentifier, pin, name: Constants.deviceName || 'Indyz POS device', tenantId: tenant?.id || '' },
      accessToken,
    );
    try {
      await Promise.all([
        setSessionValue(deviceIdKey, result.deviceId),
        SecureStore.setItemAsync(deviceTokenKey, result.deviceToken, deviceTokenOptions),
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
    const [deviceId, deviceToken] = await Promise.all([
      getSessionValue(deviceIdKey),
      SecureStore.getItemAsync(deviceTokenKey, deviceTokenOptions),
    ]);
    if (!deviceId || !deviceToken)
      throw new Error('Set up device access after signing in with your password.');
    const verified = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Indyz POS',
      disableDeviceFallback: false,
    });
    if (!verified.success) throw new Error('Device authentication was not completed.');
    const result = await request<{ user: AuthUser; tokens: Tokens; deviceToken: string }>('/device/token', {
      deviceId,
      deviceToken,
    });
    if (!result.tokens.accessToken) throw new Error('The device did not return a valid session.');
    await Promise.all([
      setSessionValue(accessTokenKey, result.tokens.accessToken),
      setSessionValue(userKey, JSON.stringify(result.user)),
      SecureStore.setItemAsync(deviceTokenKey, result.deviceToken, deviceTokenOptions),
    ]);
  },
  async changeDevicePin(pin: string): Promise<void> {
    const verified = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify to change device PIN',
      disableDeviceFallback: false,
    });
    if (!verified.success) throw new Error('Device authentication is required to change the PIN.');
    await this.registerDevice(pin);
  },
  async login({ email, password }: LoginCredentials) {
    const result = await request<CodeResponse>('/auth/login', { email, password, appId, env: 'prod' });
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
    const redirectUri = AuthSession.makeRedirectUri(
      Platform.OS === 'web' ? { path: 'auth/callback' } : { scheme: 'indyzai-pos', path: 'auth/callback' },
    );
    const state = new AuthSession.AuthRequest({
      clientId: appId,
      redirectUri,
      usePKCE: false,
    }).state;
    // Preserve AuthSession's CSRF state in the callback itself as well as in
    // the server-side OAuth state. This keeps the popup flow valid through
    // browser-based auth UI handoffs.
    const callback = new URL(redirectUri);
    callback.searchParams.set('state', state);
    const request = new AuthSession.AuthRequest({
      clientId: appId,
      redirectUri: callback.toString(),
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      state,
      extraParams: { appName: appId, redirect: callback.toString() },
    });
    const result = await request.promptAsync({ authorizationEndpoint: `${baseUrl}/auth/${provider}` });
    if (result.type === 'cancel' || result.type === 'dismiss') return false;
    if (result.type !== 'success')
      throw new Error(`${provider === 'google' ? 'Google' : 'Microsoft'} sign-in did not complete.`);
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('The authentication callback did not include a code.');
    if (!request.codeVerifier) throw new Error('Sign-in could not verify the OAuth response.');
    await exchangeCode(code, true, request.codeVerifier);
    return true;
  },
};
