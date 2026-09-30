import { StockReconciliationScreen as SharedScreen } from '@indyzai/feature-inventory/reconciliation-screen';
import { inventoryApi } from './inventoryApi';

export function StockReconciliationScreen() {
  return <SharedScreen surface="admin" inventoryApi={inventoryApi} />;
}
