import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../auth/authApi';
import { useAuthSession } from '../../auth/AuthSessionContext';

export default function AppHandoffRoute() {
  const params = useLocalSearchParams<{ code?: string | string[]; tenantId?: string | string[] }>();
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const handled = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (handled.current) return;
    const code = first(params.code);
    const tenantId = first(params.tenantId);
    if (!code || !tenantId) {
      setError('The app switch link is incomplete. Return to Admin and try again.');
      return;
    }
    handled.current = true;
    void (async () => {
      try {
        await authApi.completeAppHandoff(code, tenantId);
        await refreshSession();
        router.replace('/billing');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The app switch could not be completed.');
      }
    })();
  }, [params.code, params.tenantId, refreshSession, router]);

  return (
    <View style={styles.screen}>
      {!error && <ActivityIndicator color="#4F46E5" />}
      <Text style={[styles.message, error && styles.error]}>{error || 'Switching to POS…'}</Text>
    </View>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  message: { color: '#334155', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  error: { color: '#DC2626', fontWeight: '800' },
});
