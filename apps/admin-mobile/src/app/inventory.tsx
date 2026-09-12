import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '../shared/providers/BottomNavigationProvider';
import { InventoryScreen } from '../features/inventory/InventoryScreen';

export default function InventoryRoute() {
    return (
        <BottomNavigationProvider>
            <InventoryScreen />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
