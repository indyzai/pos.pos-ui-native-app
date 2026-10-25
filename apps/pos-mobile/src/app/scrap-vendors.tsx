import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ModuleLayout } from '../shared/components/navigation/ModuleLayout';
import { CustomersScreen } from '../features/customers/CustomersScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function ScrapVendorsRoute() {
  return (
    <BottomNavigationProvider>
      <ModuleLayout>
        <CustomersScreen onlyType="SCRAP_VENDOR" />
      </ModuleLayout>
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
