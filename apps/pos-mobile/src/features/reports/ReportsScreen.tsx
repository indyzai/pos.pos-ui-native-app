import { ReportsScreen as SharedReportsScreen } from '@indyzai/feature-reports/screen';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { canPerformManagerActions } from '../../config/appAccess';
import { useOrders } from '../orders/useOrders';

export function ReportsScreen() {
  const { session } = useAuthSession();
  const data = useOrders();
  return (
    <SharedReportsScreen
      data={data}
      surface="pos"
      managerAccess={canPerformManagerActions(session?.tenant.role, session?.user.role)}
    />
  );
}
