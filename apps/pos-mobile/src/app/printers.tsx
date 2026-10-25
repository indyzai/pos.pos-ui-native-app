import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { PrinterManagementScreen } from '@indyzai/feature-printers/management-screen';
import { printerConfigurationApi } from '../features/printing/printerConfigurationApi';
import { printerManagementApi } from '../features/printing/printerManagementApi';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function PrintersRoute() {
  return (
    <BottomNavigationProvider>
      <PrinterManagementScreen surface="pos" api={printerConfigurationApi} jobsApi={printerManagementApi} />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
