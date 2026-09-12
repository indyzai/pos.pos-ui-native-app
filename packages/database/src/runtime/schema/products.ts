import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
    "products",
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text("remote_id").notNull(),
        name: text().notNull(),
        category: text().notNull(),
        categoryType: text("category_type"),
        price: integer().notNull(),
        stock: integer().notNull(),
        barcode: text(),
        sku: text(),
        imageUrl: text("image_url"),
        quick: integer({ mode: "boolean" }).notNull().default(false),
        taxRate: integer("tax_rate").notNull(),
        details: text(),
    },
    (table) => [index("products_scope_idx").on(table.scope)],
);
