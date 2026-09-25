import { Redirect, useRouter } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { LoginScreen } from '../auth/ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { createLogger } from '@indyzai/pos-utils';

const logger = createLogger('Auth:admin-app');

export default function LoginRoute() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  const { authenticated, initializing, refreshSession } = useAuthSession();
  const finishLogin = async () => {
    logger.info('Finishing login in main window');
    const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
    await refreshSession();
    const hasToken = Boolean(await authApi.getAccessToken());
    logger.info('Main-window session refresh completed', { hasToken, needsDeviceSetup });
    if (!hasToken) throw new Error('The authentication session was not available in the main window.');
    if (Platform.OS === 'web') {
      logger.info('Reloading authenticated reports route');
      window.location.replace('/reports');
      return;
    }
    router.replace(needsDeviceSetup ? '/device-setup' : '/reports');
  };
  if (initializing) return null;
  if (authenticated) return <Redirect href="/reports" />;
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
          logger.info('Social authorization returned to login', { completed });
          if (completed) {
            await finishLogin();
          }
        }}
        hasRegisteredDevice={authApi.hasRegisteredDevice}
        onDeviceLogin={async (pin) => {
          await authApi.authenticateWithDevice(pin);
          await refreshSession();
          router.replace('/reports');
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
