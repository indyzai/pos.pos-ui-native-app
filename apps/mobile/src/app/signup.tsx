import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { SignupScreen } from '../auth/ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';

export default function SignupRoute() {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const { themeColors } = useAppTheme();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: themeColors.background }]}
      edges={['top', 'left', 'right']}
    >
      <SignupScreen
        onSignUp={async (payload) => {
          await authApi.register(payload);
          await refreshSession();
          router.replace('/billing');
        }}
        onLogin={() => router.replace('/login')}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
