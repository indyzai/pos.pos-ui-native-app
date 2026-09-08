import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../shared/query/queryClient';
import { ThemeProvider, useAppTheme } from '../shared/providers/ThemeProvider';
import { AuthSessionProvider } from '../features/auth/AuthSessionContext';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../shared/components/layout/AppHeader';
import { AppHeaderProvider, useAppHeader } from '../shared/providers/AppHeaderProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DatabaseProvider>
            <AuthSessionProvider>
              <AppHeaderProvider>
                <RootNavigator />
              </AppHeaderProvider>
            </AuthSessionProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isDark, themeColors } = useAppTheme();
  const { menuToggle } = useAppHeader();
  const pathname = usePathname();
  const headerHidden = ['/', '/login', '/signup', '/auth/callback'].includes(pathname);
  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!headerHidden && (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: themeColors.surface }}>
          <AppHeader onMenuToggle={menuToggle} />
        </SafeAreaView>
      )}
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="billing" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="device-setup" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}
