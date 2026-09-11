import { desc, eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../../../db/client';
import { initializeDatabase } from '../../../db/migrations';
import { heldOrders } from '../../../db/schema';
import { deleteWebHeldOrder, readWebHeldOrders, writeWebHeldOrder } from '../../../db/webClient';
import type { HeldOrder } from '../types/billing';

const storageId = (scope: string, id: string) => `${scope}:held-order:${id}`;

export async function listHeldOrders(scope: string): Promise<HeldOrder[]> {
  if (!hasNativeDatabase) {
    const records = await readWebHeldOrders<HeldOrder & { storageId: string; scope: string }>(scope);
    return records
      .map(({ storageId: _storageId, scope: _scope, ...order }) => order)
      .sort((left, right) => right.heldAt.localeCompare(left.heldAt));
  }
  initializeDatabase();
  return getDatabase()
    .select()
    .from(heldOrders)
    .where(eq(heldOrders.scope, scope))
    .orderBy(desc(heldOrders.heldAt))
    .all()
    .flatMap((row) => {
      try {
        return [JSON.parse(row.payload) as HeldOrder];
      } catch {
        return [];
      }
    });
}

export async function saveHeldOrder(scope: string, order: HeldOrder): Promise<void> {
  if (!hasNativeDatabase) return writeWebHeldOrder(scope, order);
  initializeDatabase();
  getDatabase()
    .insert(heldOrders)
    .values({ id: storageId(scope, order.id), scope, payload: JSON.stringify(order), heldAt: order.heldAt })
    .onConflictDoUpdate({
      target: heldOrders.id,
      set: { payload: JSON.stringify(order), heldAt: order.heldAt },
    })
    .run();
}

export async function removeHeldOrder(scope: string, id: string): Promise<void> {
  if (!hasNativeDatabase) return deleteWebHeldOrder(scope, id);
  initializeDatabase();
  getDatabase()
    .delete(heldOrders)
    .where(eq(heldOrders.id, storageId(scope, id)))
    .run();
}
