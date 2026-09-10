import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../features/auth/authApi';
import { useAuthSession } from '../../features/auth/AuthSessionContext';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackRoute() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string;
  }>();
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const handled = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' || handled.current) return;
    const code = first(params.code);
    const state = first(params.state);
    if (!code) {
      if (params.error) setError(String(params.error));
      return;
    }
    handled.current = true;
    void (async () => {
      try {
        await authApi.completeAuthorizationCode(code, state);
        const needsDeviceSetup = !(await authApi.hasRegisteredDevice());
        await refreshSession();
        router.replace(needsDeviceSetup ? '/device-setup' : '/billing');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.');
      }
    })();
  }, [params.code, params.error, params.state, refreshSession, router]);

  return (
    <View style={styles.screen}>
      {!error && <ActivityIndicator color="#4F46E5" />}
      <Text style={[styles.message, error && styles.error]}>{error || 'Completing sign-in…'}</Text>
      {error && <Text style={styles.help}>Return to sign in and try again.</Text>}
    </View>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  message: { color: '#334155', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  error: { color: '#DC2626', fontWeight: '800' },
  help: { color: '#64748B', fontSize: 12 },
});
