import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const refunds = sqliteTable(
    'refunds',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text('remote_id').notNull(),
        payload: text().notNull(),
    },
    (table) => [index('refunds_scope_idx').on(table.scope)],
);
