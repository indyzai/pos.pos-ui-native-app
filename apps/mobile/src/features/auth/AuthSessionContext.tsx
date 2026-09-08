import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadOrganizationDetails, type OrganizationDetails } from '../organization/organizationApi';
import { authApi, type AuthTenant, type AuthUser } from './authApi';

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
  const refreshSession = async () => {
    setInitializing(true);
    activeSession = null;
    setSession(null);
    setUser(null);
    setAuthenticated(false);
    try {
      const [profile, token] = await Promise.all([authApi.getSessionUser(), authApi.getAccessToken()]);
      setUser(profile);
      setAuthenticated(Boolean(profile && token));
      // Resolve membership from the profile just returned by /users/me.
      // Storage supplies only the preferred ID, never a second user snapshot.
      const tenant = await authApi.getSelectedTenant(profile);
      const next: AuthSession | null =
        profile && token && tenant ? { user: profile, token, tenant, organization: null } : null;
      activeSession = next;
      setSession(next);
      setError('');
      if (next) {
        const organization = await loadOrganizationDetails(next.token, String(next.tenant.id));
        activeSession = { ...next, organization };
        setSession(activeSession);
      } else if (await authApi.getAccessToken()) {
        setError('Signed in, but no business profile is available. Retry workspace initialization.');
      }
    } catch (reason) {
      // An organization request failure must not discard a valid signed-in identity.
      setError(reason instanceof Error ? reason.message : 'Unable to initialize your business.');
    } finally {
      setInitializing(false);
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
  return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color="#1B6EF3" />
      <Text style={s.loaderText}>Preparing your workspace…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#F9FAFF' },
  loaderText: { color: '#43474F', fontSize: 14, fontWeight: '700' },
});
