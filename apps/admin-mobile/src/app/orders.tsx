import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '../shared/providers/BottomNavigationProvider';
import { OrdersScreen } from '../features/orders/OrdersScreen';

export default function OrdersRoute() {
    return (
        <BottomNavigationProvider>
            <OrdersScreen />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
