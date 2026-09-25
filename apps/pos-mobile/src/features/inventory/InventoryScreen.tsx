import { InventoryScreen as SharedInventoryScreen } from '@indyzai/feature-inventory/screen';
import { inventoryApi } from './inventoryApi';
export function InventoryScreen() {
  return <SharedInventoryScreen surface="pos" api={inventoryApi} />;
}
