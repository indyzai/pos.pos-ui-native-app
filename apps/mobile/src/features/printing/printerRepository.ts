import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '@indyzai/pos-database/client';
import { initializeDatabase } from '@indyzai/pos-database/migrations';
import { printers } from '@indyzai/pos-database/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '@indyzai/pos-database/web-client';
import type { CounterPrinter } from './types';

export async function readPrinters(scope: string): Promise<CounterPrinter[]> {
  if (!hasNativeDatabase) {
    const rows = await readWebScopedRecords<CounterPrinter & { storageId: string; scope: string }>(
      webStores.printers,
      scope,
    );
    return rows.map(({ storageId: _storageId, scope: _scope, ...printer }) => printer);
  }
  initializeDatabase();
  return getDatabase()
    .select()
    .from(printers)
    .where(eq(printers.scope, scope))
    .all()
    .flatMap((row) => {
      try {
        return [JSON.parse(row.payload) as CounterPrinter];
      } catch {
        return [];
      }
    });
}

export async function replacePrinters(scope: string, records: CounterPrinter[]): Promise<void> {
  if (!hasNativeDatabase) return replaceWebScopedRecords(webStores.printers, scope, records);
  initializeDatabase();
  getDatabase().transaction((tx) => {
    tx.delete(printers).where(eq(printers.scope, scope)).run();
    for (const printer of records)
      tx.insert(printers)
        .values({
          id: `${scope}:printer:${printer.id}`,
          scope,
          remoteId: printer.id,
          payload: JSON.stringify(printer),
        })
        .run();
  });
}
