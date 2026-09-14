import { BottomNavigationProvider } from '@indyzai/pos-ui';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { PurchasesScreen } from '../features/purchases/PurchasesScreen';
export default function PurchasesRoute() {
  return (
    <BottomNavigationProvider>
      <PurchasesScreen />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
