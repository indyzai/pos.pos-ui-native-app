import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../shared/query/queryClient';
import { ThemeProvider, useAppTheme } from '../shared/providers/ThemeProvider';
import { AuthSessionProvider, useAuthSession } from '../features/auth/AuthSessionContext';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../shared/components/layout/AppHeader';
import { AppHeaderProvider } from '../shared/providers/AppHeaderProvider';
import { TabletNavigationPane } from '../shared/components/navigation/TabletNavigationPane';

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
  const { width, height } = useWindowDimensions();
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, initializing } = useAuthSession();
  useEffect(() => {
    if (!initializing && !authenticated && !['/', '/login', '/signup', '/auth/callback'].includes(pathname)) {
      router.replace('/login');
    }
  }, [authenticated, initializing, pathname, router]);
  const headerHidden = ['/', '/login', '/signup', '/auth/callback'].includes(pathname);
  const showLeftNavigation = !headerHidden && width >= 700 && width > height;
  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!headerHidden && (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: themeColors.surface }}>
          <AppHeader
            onMenuToggle={showLeftNavigation ? () => setNavigationCollapsed((value) => !value) : undefined}
            navigationCollapsed={navigationCollapsed}
          />
        </SafeAreaView>
      )}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {showLeftNavigation && <TabletNavigationPane collapsed={navigationCollapsed} />}
        <View style={{ flex: 1 }}>
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
      </View>
    </View>
  );
}
