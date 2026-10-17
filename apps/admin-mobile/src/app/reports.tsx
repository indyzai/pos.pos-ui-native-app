import { requestPos } from '../core/api/posApi';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ReportsScreen } from '@indyzai/feature-reports/screen';

export default function ReportsRoute() {
  return (
    <BottomNavigationProvider>
      <ReportsScreen request={requestPos} surface="admin" />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
