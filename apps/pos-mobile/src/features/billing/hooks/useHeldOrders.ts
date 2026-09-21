import * as Crypto from 'expo-crypto';
import { createLocalFirstTableHook, useLocalDatabase } from '@indyzai/pos-database';
import type { BillingOrderContext, CartItem, Customer, HeldOrder, ScrapExchange } from '../types/billing';

const useHeldOrderTable = createLocalFirstTableHook<HeldOrder>({
  table: 'held_orders',
  entityType: 'HELD_ORDER',
});

export function useHeldOrders(enabledScope?: string) {
  const local = useLocalDatabase();
  const collection = useHeldOrderTable();

  const hold = async (
    items: CartItem[],
    orderDiscount: number,
    customer?: Customer,
    orderContext?: BillingOrderContext,
    scrapExchange?: ScrapExchange,
  ) => {
    if (!enabledScope || !items.length || !local.database) return;
    const order: HeldOrder = {
      id: Crypto.randomUUID(),
      items,
      orderDiscount,
      customer,
      orderContext,
      scrapExchange,
      heldAt: new Date().toISOString(),
    };
    await collection.createMutation({
      payload: order,
      operation: 'CREATE',
      localId: order.id,
      idempotencyKey: `held-order:${order.id}`,
    });
  };

  const remove = async (id: string) => {
    if (!local.database) return;
    const record = collection.data.find((item) => item.payload.id === id);
    if (record)
      await collection.createMutation({
        payload: record.payload,
        operation: 'DELETE',
        localId: record.id,
        idempotencyKey: `held-order:${record.id}:delete`,
      });
  };

  return {
    orders: enabledScope ? collection.data.map((record) => record.payload) : [],
    hold,
    remove,
    reload: collection.reload,
  };
}
