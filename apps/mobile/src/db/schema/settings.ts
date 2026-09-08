import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const billingMetadata = sqliteTable(
  'billing_metadata',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    session: text().notNull(),
    updated: text(),
  },
  (table) => [index('billing_metadata_scope_idx').on(table.scope)],
);
