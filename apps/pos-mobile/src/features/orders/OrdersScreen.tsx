import { OrdersScreen as SharedOrdersScreen } from '@indyzai/feature-orders/orders-screen';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { canPerformManagerActions } from '../../config/appAccess';
import { useOrders } from './useOrders';

export function OrdersScreen() {
  const auth = useAuthSession();
  const data = useOrders();
  return (
    <SharedOrdersScreen
      data={data}
      canRefund={canPerformManagerActions(auth.session?.tenant.role, auth.session?.user.role)}
    />
  );
}
