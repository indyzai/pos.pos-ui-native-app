import { BottomNavigationProvider } from '@indyzai/pos-ui';
import { CustomersScreen } from '../features/customers/CustomersScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function CustomersRoute() {
  return (
    <BottomNavigationProvider>
      <CustomersScreen />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
