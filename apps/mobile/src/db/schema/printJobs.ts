import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const printJobs = sqliteTable(
  'print_jobs',
  {
    id: text().primaryKey(),
    scope: text().notNull(),
    payload: text().notNull(),
    status: text().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('print_jobs_scope_status_idx').on(table.scope, table.status)],
);
