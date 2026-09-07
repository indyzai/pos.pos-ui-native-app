import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../src/contexts/ThemeContext';
import { SignupScreen } from '../src/features/auth/SignupScreen';
import { authApi } from '../src/features/auth/authApi';

export default function SignupRoute() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: themeColors.background }]}
      edges={['top', 'left', 'right']}
    >
      <SignupScreen
        onSignUp={async (payload) => {
          await authApi.register(payload);
          router.replace('/billing');
        }}
        onLogin={() => router.replace('/login')}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
