import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const taxRates = sqliteTable(
  'tax_rates',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    remoteId: text('remote_id').notNull(),
    payload: text().notNull(),
  },
  (table) => [index('tax_rates_scope_idx').on(table.scope)],
);
