import {
    createScopeKey,
    type CollectionName,
    type LocalDatabase,
    type LocalRecord,
} from "./types";

export async function replaceLocalPayloads<T extends { id: string }>(
    database: LocalDatabase,
    collection: CollectionName,
    payloads: readonly T[],
): Promise<void> {
    await database.collection<LocalRecord<T>>(collection).replace(
        localRecordsFromPayloads(database, collection, payloads),
    );
}

export function localRecordsFromPayloads<T extends { id: string }>(
    database: LocalDatabase,
    collection: CollectionName,
    payloads: readonly T[],
): LocalRecord<T>[] {
    const scope = database.scope;
    const scopeKey = createScopeKey(scope);
    const now = Date.now();
    return payloads.map((payload) => {
        const metadata = payload as T & {
            serverVersion?: number;
            updatedAt?: number | string;
        };
        return {
            id: `${scopeKey}:${collection}:${payload.id}`,
            scope: scopeKey,
            tenantId: scope.tenantId,
            storeId: scope.storeIds[0] ?? null,
            remoteId: payload.id,
            payload,
            serverVersion: Number(metadata.serverVersion ?? 0),
            syncStatus: "API",
            updatedAt:
                typeof metadata.updatedAt === "string"
                    ? Date.parse(metadata.updatedAt) || now
                    : Number(metadata.updatedAt ?? now),
            deletedAt: null,
        };
    });
}

const bootstrapCollectionMap: Record<string, CollectionName> = {
    products: "products", categories: "categories", units: "product_uoms",
    taxRates: "tax_rates", customers: "customers", serviceUsers: "service_users",
    branches: "stores", counters: "counters", counterSessions: "shifts",
    paymentMethods: "payment_methods", sales: "sales", refunds: "refunds",
    purchases: "purchase_orders", waybills: "waybill_jobs", transfers: "transfers",
    stockTransfers: "transfers", tables: "restaurant_tables", printers: "printers",
};

/** Applies a server bootstrap snapshot without discarding unsynced local work. */
export async function applyBootstrapCollections(
    database: LocalDatabase,
    collections: Record<string, readonly Record<string, unknown>[]>,
    loadedAt: number | string = Date.now(),
): Promise<void> {
    const timestamp = typeof loadedAt === "string"
        ? Date.parse(loadedAt) || Date.now()
        : loadedAt;
    const applied = new Set<CollectionName>();
    for (const [serverName, payloads] of Object.entries(collections)) {
        const collection = bootstrapCollectionMap[serverName];
        if (!collection || applied.has(collection)) continue;
        applied.add(collection);
        let repository;
        try { repository = database.collection<LocalRecord>(collection); }
        catch { continue; }
        const serverRecords = localRecordsFromPayloads(
            database,
            collection,
            payloads.filter((payload) => payload.id != null).map((payload) => ({ ...payload, id: String(payload.id) })),
        );
        const pending = (await repository.list({ includeDeleted: true }))
            .filter((record) => ["PENDING", "RUNNING", "FAILED", "CONFLICT"].includes(record.syncStatus));
        const pendingRemoteIds = new Set(pending.map((record) => record.remoteId));
        await repository.replace([
            ...serverRecords.filter((record) => !pendingRemoteIds.has(record.remoteId)),
            ...pending,
        ]);
        const state = database.collection<LocalRecord<{ collection: string; lastSyncedAt: number }>>("sync_state");
        const scopeKey = createScopeKey(database.scope);
        await state.put({
            id: `${scopeKey}:sync_state:${collection}`,
            scope: scopeKey,
            tenantId: database.scope.tenantId,
            storeId: database.scope.storeIds[0] ?? null,
            remoteId: collection,
            payload: { collection, lastSyncedAt: timestamp },
            serverVersion: 0,
            syncStatus: "API",
            updatedAt: timestamp,
            deletedAt: null,
        });
    }
}

export const payloadsFromRecords = <T>(
    records: readonly LocalRecord<T>[],
): T[] => records.map((record) => record.payload);
