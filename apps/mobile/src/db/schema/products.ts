import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable(
  'products',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    remoteId: text('remote_id').notNull(),
    name: text().notNull(),
    category: text().notNull(),
    price: integer().notNull(),
    stock: integer().notNull(),
    barcode: text(),
    taxRate: integer('tax_rate').notNull(),
  },
  (table) => [index('products_scope_idx').on(table.scope)],
);
