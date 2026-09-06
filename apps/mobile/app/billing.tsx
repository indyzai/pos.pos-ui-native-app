import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '../src/contexts/BottomNavigationContext';
import { useAppTheme } from '../src/contexts/ThemeContext';
import { BillingScreen } from '../src/features/billing/BillingScreen';

export default function BillingRoute() {
  const { themeColors } = useAppTheme();
  return (
    <BottomNavigationProvider>
      <SafeAreaView style={[styles.screen, { backgroundColor: themeColors.background }]} edges={['top']}>
        <BillingScreen />
        <BottomNavigation />
      </SafeAreaView>
    </BottomNavigationProvider>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
