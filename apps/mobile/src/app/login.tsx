import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { LoginScreen } from '../auth/ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';

export default function LoginRoute() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  const { authenticated, initializing, refreshSession } = useAuthSession();
  const [authenticatedRoute, setAuthenticatedRoute] = useState<'/billing' | '/device-setup'>('/billing');
  const finishLogin = async () => {
    const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
    setAuthenticatedRoute(needsDeviceSetup ? '/device-setup' : '/billing');
    await refreshSession();
  };
  if (initializing) return null;
  if (authenticated) return <Redirect href={authenticatedRoute} />;
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
          setAuthenticatedRoute('/billing');
          await refreshSession();
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
