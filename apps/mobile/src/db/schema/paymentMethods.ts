import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const paymentMethods = sqliteTable(
  'payment_methods',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    remoteId: text('remote_id').notNull(),
    payload: text().notNull(),
  },
  (table) => [index('payment_methods_scope_idx').on(table.scope)],
);
