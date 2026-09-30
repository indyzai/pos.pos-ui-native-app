import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ReportsScreen } from '@indyzai/feature-reports/screen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function ReportsRoute() {
  return (
    <BottomNavigationProvider>
      <ReportsScreen surface="pos" />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
