import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../shared/query/queryClient';
import { ThemeProvider, useAppTheme } from '../shared/providers/ThemeProvider';
import { AuthSessionProvider } from '../features/auth/AuthSessionContext';
import { DatabaseProvider } from '../db/DatabaseProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DatabaseProvider>
            <AuthSessionProvider>
              <RootNavigator />
            </AuthSessionProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isDark } = useAppTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="billing" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="device-setup" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
