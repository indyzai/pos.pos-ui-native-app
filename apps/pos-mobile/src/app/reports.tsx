import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ReportsScreen } from '../features/reports/ReportsScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function ReportsRoute() {
  return (
    <BottomNavigationProvider>
      <ReportsScreen />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
