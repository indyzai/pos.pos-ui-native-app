import { ModuleLayout } from '../shared/components/navigation/ModuleLayout';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { OperationsScreen } from '../features/operations/OperationsScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function OperationsRoute() {
  return (
    <BottomNavigationProvider>
      <ModuleLayout>
        <OperationsScreen resource="scrapStock" />
      </ModuleLayout>
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
