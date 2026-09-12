import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable(
    "customers",
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text("remote_id").notNull(),
        payload: text().notNull(),
    },
    (table) => [index("customers_scope_idx").on(table.scope)],
);
