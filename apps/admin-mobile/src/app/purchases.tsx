import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { PurchasesScreen } from '../../../pos-mobile/src/features/purchases/PurchasesScreen';
export default function PurchasesRoute() {
    return (
        <BottomNavigationProvider>
            <PurchasesScreen surface="admin" />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
