import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { StockReconciliationScreen } from '../features/inventory/StockReconciliationScreen';

export default function InventoryReconciliationRoute() {
  return (
    <BottomNavigationProvider>
      <StockReconciliationScreen />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
