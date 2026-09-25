import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { AuthCallbackScreen } from '@indyzai/pos-auth/callback';
import { authApi } from '../../auth/authApi';
import { useAuthSession } from '../../auth/AuthSessionContext';

export default function AuthCallbackRoute() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string;
  }>();
  const router = useRouter();
  const { refreshSession } = useAuthSession();

  return (
    <AuthCallbackScreen
      code={params.code}
      state={params.state}
      error={params.error}
      loggerScope="Auth:pos-app"
      onComplete={async (code, state) => {
        await authApi.completeAuthorizationCode(code, state);
        const needsDeviceSetup = Platform.OS !== 'web' && !(await authApi.hasRegisteredDevice());
        await refreshSession();
        router.replace(needsDeviceSetup ? '/device-setup' : '/billing');
      }}
      onSuccess={() => {}}
    />
  );
}
