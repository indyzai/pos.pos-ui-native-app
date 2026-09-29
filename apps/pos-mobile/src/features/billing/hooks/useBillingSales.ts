import { createOfflineTableHook } from '@indyzai/pos-database';
import type { PendingSale } from '@indyzai/feature-billing/salesOutbox';

/** Local-first billing sale rows and their dependency-aware outbox mutations. */
export const useBillingSales = createOfflineTableHook<PendingSale>({
  table: 'sales',
  entityType: 'SALE',
  query: { includeDeleted: true },
});
