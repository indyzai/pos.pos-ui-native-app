import { Redirect, useRouter } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { LoginScreen } from '../auth/ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { createLogger } from '@indyzai/pos-core';

const logger = createLogger('Auth:admin-app');

export default function LoginRoute() {
    const router = useRouter();
    const { themeColors } = useAppTheme();
    const { authenticated, initializing, refreshSession } = useAuthSession();
    const finishLogin = async () => {
        if (__DEV__) logger.info('Finishing login in main window');
        const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
        await refreshSession();
        const hasToken = Boolean(await authApi.getAccessToken());
        if (__DEV__) logger.info('Main-window session refresh completed', { hasToken, needsDeviceSetup });
        if (!hasToken) throw new Error('The authentication session was not available in the main window.');
        if (Platform.OS === 'web') {
            if (__DEV__) logger.info('Reloading authenticated billing route');
            window.location.replace('/billing');
            return;
        }
        router.replace(needsDeviceSetup ? '/device-setup' : '/billing');
    };
    if (initializing) return null;
    if (authenticated) return <Redirect href="/billing" />;
    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: themeColors.background }]}
            edges={['top', 'left', 'right']}
        >
            <LoginScreen
                onLogin={async (credentials) => {
                    await authApi.login(credentials);
                    await finishLogin();
                }}
                onSignUp={() => router.push('/signup')}
                onSocialLogin={async (provider) => {
                    const completed = await authApi.authorize(provider);
                    if (__DEV__) logger.info('Social authorization returned to login', { completed });
                    if (completed) {
                        await finishLogin();
                    }
                }}
                onDeviceLogin={async () => {
                    await authApi.authenticateWithDevice();
                    await refreshSession();
                    router.replace('/billing');
                }}
            />
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
