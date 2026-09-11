import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const productBatches = sqliteTable(
  'product_batches',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    remoteId: text('remote_id').notNull(),
    payload: text().notNull(),
  },
  (table) => [index('product_batches_scope_product_idx').on(table.scope)],
);
