import { useInventory as useSharedInventory } from '@indyzai/feature-inventory/hook';
import { inventoryApi } from '../inventoryApi';
export function useInventory() {
    return useSharedInventory(inventoryApi);
}
