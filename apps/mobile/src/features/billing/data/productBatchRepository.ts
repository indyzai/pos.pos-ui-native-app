import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '@indyzai/pos-database/client';
import { initializeDatabase } from '@indyzai/pos-database/migrations';
import { productBatches } from '@indyzai/pos-database/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '@indyzai/pos-database/web-client';
import type { ProductBatch } from '../types/billing';

export const productBatchRepository = {
  async read(scope: string): Promise<ProductBatch[]> {
    if (!hasNativeDatabase) {
      const rows = await readWebScopedRecords<ProductBatch & { storageId: string; scope: string }>(
        webStores.productBatches,
        scope,
      );
      return rows.map(({ storageId: _id, scope: _scope, ...batch }) => batch);
    }
    initializeDatabase();
    return getDatabase()
      .select()
      .from(productBatches)
      .where(eq(productBatches.scope, scope))
      .all()
      .flatMap((row) => {
        try {
          return [JSON.parse(row.payload) as ProductBatch];
        } catch {
          return [];
        }
      });
  },
  async replace(scope: string, batches: ProductBatch[]): Promise<void> {
    if (!hasNativeDatabase) return replaceWebScopedRecords(webStores.productBatches, scope, batches);
    initializeDatabase();
    getDatabase().transaction((tx) => {
      tx.delete(productBatches).where(eq(productBatches.scope, scope)).run();
      for (const batch of batches)
        tx.insert(productBatches)
          .values({
            id: `${scope}:product-batch:${batch.id}`,
            scope,
            remoteId: batch.id,
            payload: JSON.stringify(batch),
          })
          .run();
    });
  },
};
