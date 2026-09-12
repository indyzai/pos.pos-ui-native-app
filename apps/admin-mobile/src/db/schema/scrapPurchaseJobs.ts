import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const scrapPurchaseJobs = sqliteTable(
    'scrap_purchase_jobs',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        remoteId: text('remote_id').notNull(),
        payload: text().notNull(),
        status: text().notNull(),
        errorMessage: text('error_message'),
        createdAt: text('created_at').notNull(),
    },
    (table) => [index('scrap_purchase_jobs_scope_status_idx').on(table.scope, table.status)],
);
