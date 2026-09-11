import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../../db/client';
import { initializeDatabase } from '../../db/migrations';
import { orders, refunds } from '../../db/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '../../db/webClient';
import type { RefundRecord, SalesOrder } from './types';

type PayloadTable = typeof orders | typeof refunds;
type StoreName = typeof webStores.orders | typeof webStores.refunds;

async function readRecords<T>(scope: string, table: PayloadTable, storeName: StoreName): Promise<T[]> {
  if (!hasNativeDatabase) {
    const rows = await readWebScopedRecords<T & { storageId: string; scope: string }>(storeName, scope);
    return rows.map(({ storageId: _id, scope: _scope, ...record }) => record as T);
  }
  initializeDatabase();
  return getDatabase()
    .select()
    .from(table)
    .where(eq(table.scope, scope))
    .all()
    .flatMap((row) => {
      try {
        return [JSON.parse(row.payload) as T];
      } catch {
        return [];
      }
    });
}

async function replaceRecords<T extends { id: string }>(
  scope: string,
  records: T[],
  table: PayloadTable,
  storeName: StoreName,
) {
  if (!hasNativeDatabase) return replaceWebScopedRecords(storeName, scope, records);
  initializeDatabase();
  getDatabase().transaction((tx) => {
    tx.delete(table).where(eq(table.scope, scope)).run();
    for (const record of records)
      tx.insert(table)
        .values({
          id: `${scope}:${storeName}:${record.id}`,
          scope,
          remoteId: record.id,
          payload: JSON.stringify(record),
        })
        .run();
  });
}

export const ordersRepository = {
  readOrders: (scope: string) => readRecords<SalesOrder>(scope, orders, webStores.orders),
  replaceOrders: (scope: string, records: SalesOrder[]) =>
    replaceRecords(scope, records, orders, webStores.orders),
  readRefunds: (scope: string) => readRecords<RefundRecord>(scope, refunds, webStores.refunds),
  replaceRefunds: (scope: string, records: RefundRecord[]) =>
    replaceRecords(scope, records, refunds, webStores.refunds),
};
