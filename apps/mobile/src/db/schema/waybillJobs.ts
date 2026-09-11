import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const waybillJobs = sqliteTable(
  'waybill_jobs',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    saleOfflineId: text('sale_offline_id').notNull(),
    payload: text().notNull(),
    status: text().notNull(),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('waybill_jobs_scope_status_idx').on(table.scope, table.status)],
);
