import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const baseUrl =
  process.env.EXPO_PUBLIC_AUTH_API_URL ??
  (!__DEV__ ? 'http://localhost:3504/api/v1' : 'https://api.indyzai.com/auth/api/v1');
const appId = process.env.EXPO_PUBLIC_AUTH_APP_ID ?? (Platform.OS === 'web' ? 'pos' : 'pos-app');
const accessTokenKey = 'indyzai.access-token';
const refreshTokenKey = 'indyzai.refresh-token';

type Tokens = { accessToken?: string; refreshToken?: string };
type CodeResponse = Tokens & { code?: string; applicationCode?: string };

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

async function saveTokens(tokens: Tokens): Promise<void> {
  if (!tokens.accessToken || !tokens.refreshToken)
    throw new Error('The authentication service did not return a complete session.');
  await Promise.all([
    SecureStore.setItemAsync(accessTokenKey, tokens.accessToken),
    SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken),
  ]);
}

async function exchangeCode(code: string, applicationCode = false, codeVerifier?: string): Promise<void> {
  const result = await request<{ tokens?: Tokens } & Tokens>(
    applicationCode ? '/auth/app/success' : '/auth/success',
    applicationCode && codeVerifier ? { code, codeVerifier } : { code },
  );
  await saveTokens(result.tokens ?? result);
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
  async login({ email, password }: LoginCredentials) {
    const result = await request<CodeResponse>('/auth/login', { email, password, appId, env: 'prod' });
    if (result.accessToken && result.refreshToken) return saveTokens(result);
    if (!result.code) throw new Error('The authentication service did not return a login code.');
    return exchangeCode(result.code);
  },
  async register(payload: RegistrationPayload) {
    const result = await request<Tokens>('/auth/register', payload);
    return saveTokens(result);
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
    console.log('result', result);
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
