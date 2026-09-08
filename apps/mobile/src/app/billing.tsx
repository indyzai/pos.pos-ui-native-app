import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '../shared/providers/BottomNavigationProvider';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { BillingScreen } from '../features/billing/BillingScreen';

export default function BillingRoute() {
  const { themeColors } = useAppTheme();
  return (
    <BottomNavigationProvider>
      <SafeAreaView
        style={[styles.screen, { backgroundColor: themeColors.background }]}
        edges={['left', 'right']}
      >
        <BillingScreen />
        <BottomNavigation />
      </SafeAreaView>
    </BottomNavigationProvider>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
