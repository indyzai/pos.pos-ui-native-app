import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type SyncJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type SyncJobOperation = 'CREATE_PRODUCT' | 'UPDATE_STOCK';

export const syncJobs = sqliteTable(
    'sync_jobs',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        operation: text().$type<SyncJobOperation>().notNull(),
        entityId: text('entity_id'),
        status: text().$type<SyncJobStatus>().notNull(),
        errorMessage: text('error_message'),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => [index('sync_jobs_scope_updated_idx').on(table.scope, table.updatedAt)],
);
