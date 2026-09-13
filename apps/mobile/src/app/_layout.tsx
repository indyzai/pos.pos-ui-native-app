import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@indyzai/pos-core/query';
import { ThemeProvider, useAppTheme } from '@indyzai/pos-ui';
import { AuthSessionProvider, useAuthSession } from '../auth/AuthSessionContext';
import { DatabaseProvider } from '../providers/DatabaseProvider';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../shared/components/layout/AppHeader';
import { GlobalDataLoader } from '../shared/components/layout/GlobalDataLoader';
import { AppHeaderProvider } from '@indyzai/pos-ui';
import { TabletNavigationPane } from '../shared/components/navigation/TabletNavigationPane';
import { SnackbarProvider } from '@indyzai/pos-ui/snackbar';
import { AppPaperProvider } from '@indyzai/pos-ui';
import {
  moreNavigationItems,
  navigationItemsForRole,
  primaryNavigationItems,
  reportNavigationItem,
  resolveStoreAccessRole,
} from '../shared/navigation/routes';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppPaperProvider>
            <ThemedSnackbarProvider>
              <AuthSessionProvider>
                <DatabaseProvider>
                  <AppHeaderProvider>
                    <RootNavigator />
                  </AppHeaderProvider>
                </DatabaseProvider>
              </AuthSessionProvider>
            </ThemedSnackbarProvider>
          </AppPaperProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ThemedSnackbarProvider({ children }: { children: ReactNode }) {
  const { themeColors } = useAppTheme();
  return <SnackbarProvider colors={themeColors}>{children}</SnackbarProvider>;
}

function RootNavigator() {
  const { isDark, themeColors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, initializing, session } = useAuthSession();
  useEffect(() => {
    const publicRoutes = ['/', '/login', '/signup', '/auth/callback', '/auth/handoff', '/device-setup'];
    if (!initializing && !authenticated && !publicRoutes.includes(pathname)) {
      router.replace('/login');
      return;
    }
    if (
      !initializing &&
      authenticated &&
      session &&
      !publicRoutes.includes(pathname) &&
      pathname !== '/profile'
    ) {
      const role = resolveStoreAccessRole(session.tenant.role, session.user.role);
      const allowed = navigationItemsForRole(
        [...primaryNavigationItems, ...moreNavigationItems, reportNavigationItem],
        role,
      ).some((item) => {
        const href = typeof item.href === 'string' ? item.href : item.href.pathname;
        return pathname === href || pathname.startsWith(`${href}/`);
      });
      if (!allowed) router.replace('/billing');
    }
  }, [authenticated, initializing, pathname, router, session]);
  const headerHidden = [
    '/',
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/handoff',
    '/device-setup',
  ].includes(pathname);
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
      {!headerHidden && <GlobalDataLoader />}
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
