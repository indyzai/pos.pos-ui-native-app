import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const printers = sqliteTable(
  'printers',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    remoteId: text('remote_id').notNull(),
    payload: text().notNull(),
  },
  (table) => [index('printers_scope_idx').on(table.scope)],
);
