import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '@indyzai/pos-ui';
import { OrdersScreen } from '../features/orders/OrdersScreen';

export default function OrdersRoute() {
    return (
        <BottomNavigationProvider>
            <OrdersScreen />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
