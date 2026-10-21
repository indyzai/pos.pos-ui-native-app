import { openReportWidget } from '../features/orders/reportNavigation';
import { openReportRecords } from '../features/orders/reportNavigation';
import { requestPos } from '../core/api/posApi';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ReportsScreen } from '@indyzai/feature-reports/screen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function ReportsRoute() {
  return (
    <BottomNavigationProvider>
      <ReportsScreen
        onOpenWidget={openReportWidget}
        request={requestPos}
        surface="pos"
        onOpenRecords={openReportRecords}
      />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
