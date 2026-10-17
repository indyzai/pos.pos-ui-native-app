import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { MetadataScreen } from '../features/catalog/MetadataScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function CatalogSetupRoute() {
  return (
    <BottomNavigationProvider>
      <MetadataScreen />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
