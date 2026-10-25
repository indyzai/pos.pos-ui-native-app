import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { OperationsScreen } from '../features/operations/OperationsScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function OperationsRoute() {
  return (
    <BottomNavigationProvider>
      <OperationsScreen resource="tables" />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
