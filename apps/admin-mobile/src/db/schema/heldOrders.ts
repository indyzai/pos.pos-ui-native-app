import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const heldOrders = sqliteTable(
    'held_orders',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        payload: text().notNull(),
        heldAt: text('held_at').notNull(),
    },
    (table) => [index('held_orders_scope_held_at_idx').on(table.scope, table.heldAt)],
);
