import type { ComponentProps } from 'react';
import { ReconcileStockModal as SharedModal } from '@indyzai/feature-inventory/reconcile-modal';

export function ReconcileStockModal(
  props: Omit<ComponentProps<typeof SharedModal>, 'onSaveDraft' | 'saveLabel'>,
) {
  return <SharedModal {...props} saveLabel="Save count" />;
}
