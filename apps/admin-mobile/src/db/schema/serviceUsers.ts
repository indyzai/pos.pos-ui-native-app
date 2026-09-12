import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const serviceUsers = sqliteTable(
    'service_users',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text('remote_id').notNull(),
        payload: text().notNull(),
    },
    (table) => [index('service_users_scope_idx').on(table.scope)],
);
