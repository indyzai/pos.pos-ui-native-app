import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../auth/authApi';
import { useAuthSession } from '../../auth/AuthSessionContext';

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
        if (handled.current) return;
        const code = first(params.code);
        const state = first(params.state);
        if (__DEV__) console.info('[Auth:admin-app] Callback route loaded', { hasCode: Boolean(code), hasState: Boolean(state), platform: Platform.OS });
        if (!code) {
            if (params.error) setError(String(params.error));
            return;
        }
        handled.current = true;
        void (async () => {
            try {
                await authApi.completeAuthorizationCode(code, state);
                const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
                await refreshSession();
                if (__DEV__) console.info('[Auth:admin-app] Session refreshed after callback', { needsDeviceSetup });
                if (Platform.OS === 'web') {
                    if (__DEV__) console.info('[Auth:admin-app] Closing authentication popup');
                    window.close();
                    return;
                }
                router.replace(needsDeviceSetup ? '/device-setup' : '/billing');
            } catch (reason) {
                if (__DEV__) console.error('[Auth:admin-app] Callback failed', reason);
                setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.');
            }
        })();
    }, [params.code, params.error, params.state, refreshSession, router]);

    return (
        <View style={styles.screen}>
            {!error && <ActivityIndicator color="#4F46E5" />}
            <Text style={[styles.message, Boolean(error) && styles.error]}>
                {error || 'Completing sign-in…'}
            </Text>
            {error ? <Text style={styles.help}>Return to sign in and try again.</Text> : null}
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
