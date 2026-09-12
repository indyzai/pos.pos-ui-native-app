import { Redirect, useRouter } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { LoginScreen } from '../features/auth/LoginScreen';
import { authApi } from '../features/auth/authApi';
import { useAuthSession } from '../features/auth/AuthSessionContext';

export default function LoginRoute() {
    const router = useRouter();
    const { themeColors } = useAppTheme();
    const { authenticated, initializing, refreshSession } = useAuthSession();
    const finishLogin = async () => {
        const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
        await refreshSession();
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
