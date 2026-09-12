import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const restaurantTables = sqliteTable(
    'restaurant_tables',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text('remote_id').notNull(),
        payload: text().notNull(),
    },
    (table) => [index('restaurant_tables_scope_idx').on(table.scope)],
);
