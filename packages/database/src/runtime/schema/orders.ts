import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
    "orders",
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text("remote_id").notNull(),
        payload: text().notNull(),
    },
    (table) => [index("orders_scope_idx").on(table.scope)],
);
