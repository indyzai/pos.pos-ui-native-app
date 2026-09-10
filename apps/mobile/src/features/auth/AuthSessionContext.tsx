import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../../core/api/baseApi';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadOrganizationDetails, type OrganizationDetails } from '../organization/organizationApi';
import { authApi, type AuthTenant, type AuthUser } from './authApi';
import { useAppTheme } from '../../shared/providers/ThemeProvider';

export type AuthSession = {
  user: AuthUser;
  tenant: AuthTenant;
  token: string;
  organization: OrganizationDetails | null;
};
type AuthSessionValue = {
  user: AuthUser | null;
  authenticated: boolean;
  session: AuthSession | null;
  initializing: boolean;
  error: string;
  refreshSession: () => Promise<void>;
};
const AuthSessionContext = createContext<AuthSessionValue | null>(null);
let activeSession: AuthSession | null = null;

export const getActiveAuthSession = () => activeSession;

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    let pending: Promise<void> | undefined;
    return setUnauthorizedHandler(async (token) => {
      if (pending) return pending;
      if ((await authApi.getAccessToken()) !== token) return;
      pending = (async () => {
        generation.current++;
        activeSession = null;
        setSession(null);
        setUser(null);
        setAuthenticated(false);
        setInitializing(false);
        setError('Session expired. Please sign in again.');
        await authApi.logout();
      })();
      try {
        await pending;
      } finally {
        pending = undefined;
      }
    });
  }, []);
  const refreshSession = async () => {
    const current = ++generation.current;
    setInitializing(true);
    activeSession = null;
    setSession(null);
    setUser(null);
    setAuthenticated(false);
    try {
      const [profile, token] = await Promise.all([authApi.getSessionUser(), authApi.getAccessToken()]);
      if (current !== generation.current) return;
      setUser(profile);
      setAuthenticated(Boolean(profile && token));
      // Resolve membership from the profile just returned by /users/me.
      // Storage supplies only the preferred ID, never a second user snapshot.
      const tenant = await authApi.getSelectedTenant(profile);
      if (current !== generation.current) return;
      const next: AuthSession | null =
        profile && token && tenant ? { user: profile, token, tenant, organization: null } : null;
      activeSession = next;
      setSession(next);
      setError('');
      if (next) {
        const organization = await loadOrganizationDetails(next.token, String(next.tenant.id));
        if (current !== generation.current) return;
        activeSession = { ...next, organization };
        setSession(activeSession);
      } else if (await authApi.getAccessToken()) {
        setError('Signed in, but no business profile is available. Retry workspace initialization.');
      }
    } catch (reason) {
      if (current !== generation.current) return;
      // An organization request failure must not discard a valid signed-in identity.
      setError(reason instanceof Error ? reason.message : 'Unable to initialize your business.');
    } finally {
      if (current === generation.current) setInitializing(false);
    }
  };
  useEffect(() => {
    void refreshSession();
  }, []);
  const value = useMemo(
    () => ({ user, authenticated, session, initializing, error, refreshSession }),
    [user, authenticated, session, initializing, error],
  );
  return (
    <AuthSessionContext.Provider value={value}>
      {children}
      {initializing && (
        <View style={StyleSheet.absoluteFill}>
          <StartupLoader />
        </View>
      )}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return value;
}

function StartupLoader() {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={[s.loader, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={[s.loaderText, { color: c.textSecondary }]}>Preparing your workspace…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loaderText: { fontSize: 14, fontWeight: '700' },
});
