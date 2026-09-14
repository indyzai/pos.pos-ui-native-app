import { createLocalFirstTableHook } from '@indyzai/pos-database';
import type { PendingSale } from '../../sales/salesOutbox';

/** Local-first billing sale rows and their dependency-aware outbox mutations. */
export const useBillingSales = createLocalFirstTableHook<PendingSale>({
  table: 'sales',
  entityType: 'SALE',
  query: { includeDeleted: true },
});
