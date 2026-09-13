import { Redirect, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { DeviceSetupScreen } from '@indyzai/pos-auth/device-setup';
import { useAppTheme } from '@indyzai/pos-ui';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';

export default function DeviceSetup() {
  const router = useRouter();
  const { themeColors } = useAppTheme();
  const { refreshSession } = useAuthSession();

  if (Platform.OS === 'web') return <Redirect href="/login" />;

  return (
    <DeviceSetupScreen
      colors={themeColors}
      onRegister={async (pin) => {
        await authApi.registerDevice(pin);
        await refreshSession();
      }}
      onSuccess={() => {
        router.replace('/billing');
      }}
    />
  );
}
