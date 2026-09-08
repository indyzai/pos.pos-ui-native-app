import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { LoginScreen } from '../features/auth/LoginScreen';
import { authApi } from '../features/auth/authApi';
import { useAuthSession } from '../features/auth/AuthSessionContext';

export default function LoginRoute() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  const { authenticated, initializing, refreshSession } = useAuthSession();
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
          await refreshSession();
        }}
        onSignUp={() => router.push('/signup')}
        onSocialLogin={async (provider) => {
          const completed = await authApi.authorize(provider);
          if (completed) {
            await refreshSession();
          }
        }}
        onDeviceLogin={async () => {
          await authApi.authenticateWithDevice();
          await refreshSession();
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
