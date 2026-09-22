import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { PurchasesScreen } from '../../../pos-mobile/src/features/purchases/PurchasesScreen';
import { purchasesApi } from '../features/purchases/purchasesApi';
export default function PurchasesRoute() {
    return (
        <BottomNavigationProvider>
            <PurchasesScreen surface="admin" api={purchasesApi} />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
