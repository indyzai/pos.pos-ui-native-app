import { BottomNavigationProvider } from '@indyzai/pos-ui';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { PurchasesScreen } from '../../../mobile/src/features/purchases/PurchasesScreen';
export default function PurchasesRoute() {
    return (
        <BottomNavigationProvider>
            <PurchasesScreen surface="admin" />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
