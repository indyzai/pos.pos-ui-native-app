import { ReportsScreen as SharedReportsScreen } from '@indyzai/feature-reports/screen';
import { useOrders } from '../orders/useOrders';

export function ReportsScreen() {
  const data = useOrders();
  return <SharedReportsScreen data={data} surface="admin" />;
}
