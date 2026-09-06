import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from './src/components/navigation/BottomNavigation';
import { colors } from './src/constants/theme';
import { BottomNavigationProvider } from './src/contexts/BottomNavigationContext';
import { ThemeProvider, useAppTheme } from './src/contexts/ThemeContext';
import { BillingScreen } from './src/features/billing/BillingScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
function AppShell() {
  const { isDark, themeColors } = useAppTheme();
  return (
    <BottomNavigationProvider>
      <SafeAreaView style={[styles.app, { backgroundColor: themeColors.background }]} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BillingScreen />
        <BottomNavigation />
      </SafeAreaView>
    </BottomNavigationProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.background } });
