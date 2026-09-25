import type { ComponentProps } from 'react';
import { AddInventoryItemModal as SharedModal } from '@indyzai/feature-inventory/item-modal';
import { inventoryApi } from '../inventoryApi';
export function AddInventoryItemModal(props: Omit<ComponentProps<typeof SharedModal>, 'inventoryApi'>) {
  return <SharedModal {...props} inventoryApi={inventoryApi} />;
}
