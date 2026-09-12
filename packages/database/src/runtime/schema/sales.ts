import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sales = sqliteTable(
    "sales",
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        offlineId: text("offline_id").notNull(),
        payload: text().notNull(),
        status: text().$type<"PENDING" | "FAILED" | "SYNCED">().notNull(),
        errorMessage: text("error_message"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [index("sales_scope_status_idx").on(table.scope, table.status)],
);
