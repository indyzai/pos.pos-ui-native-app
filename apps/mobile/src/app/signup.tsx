import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { createLogger } from '@indyzai/pos-core';
import { SignupScreen } from '../auth/ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';

const logger = createLogger('Auth:signup');

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
          logger.info('Registering user account', { email: payload.email, companyName: payload.companyName });
          try {
            await authApi.register(payload);
            await refreshSession();
            logger.info('Registration completed, redirecting to billing');
            router.replace('/billing');
          } catch (error) {
            logger.error('Registration failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }}
        onLogin={() => router.replace('/login')}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
