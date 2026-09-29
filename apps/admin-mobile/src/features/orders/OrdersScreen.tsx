import { OrdersScreen as SharedOrdersScreen } from '@indyzai/feature-orders/orders-screen';
import { useOrders } from './useOrders';

export function OrdersScreen() {
  const data = useOrders();
  return <SharedOrdersScreen data={data} canRefund loadingId="admin-orders" />;
}
