import * as Crypto from 'expo-crypto';
import { createScopeKey, useLocalCollection, useLocalDatabase } from '@indyzai/pos-database';
import type { LocalRecord } from '@indyzai/pos-database';
import type { BillingOrderContext, CartItem, Customer, HeldOrder, ScrapExchange } from '../types/billing';

export function useHeldOrders(enabledScope?: string) {
    const local = useLocalDatabase();
    const collection = useLocalCollection<LocalRecord<HeldOrder>>('held_orders');

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
        const scopeKey = createScopeKey(local.database.scope);
        await local.database.collection<LocalRecord<HeldOrder>>('held_orders').put({
            id: `${scopeKey}:held_orders:${order.id}`,
            scope: scopeKey,
            tenantId: local.database.scope.tenantId,
            storeId: local.database.scope.storeIds[0] ?? null,
            remoteId: order.id,
            payload: order,
            serverVersion: 0,
            syncStatus: 'PENDING',
            updatedAt: Date.parse(order.heldAt),
            deletedAt: null,
        });
    };

    const remove = async (id: string) => {
        if (!local.database) return;
        const record = collection.records.find((item) => item.payload.id === id);
        if (record) await local.database.collection('held_orders').remove(record.id);
    };

    return {
        orders: enabledScope ? collection.records.map((record) => record.payload) : [],
        hold,
        remove,
        reload: collection.reload,
    };
}
