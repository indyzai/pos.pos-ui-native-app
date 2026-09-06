import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../src/contexts/ThemeContext';
import { LoginScreen } from '../src/features/auth/LoginScreen';
import { authApi } from '../src/features/auth/authApi';

export default function LoginRoute() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: themeColors.background }]}
      edges={['top', 'left', 'right']}
    >
      <LoginScreen
        onLogin={async (credentials) => {
          await authApi.login(credentials);
          router.replace('/billing');
        }}
        onSignUp={() => router.push('/signup')}
        onSocialLogin={async (provider) => {
          const completed = await authApi.authorize(provider);
          if (completed) router.replace('/billing');
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
