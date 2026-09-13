import Dexie, { type Table } from "dexie";
import type { CollectionName, LocalRecord } from "../../types";

const indexes =
    "id, scope, tenantId, storeId, remoteId, syncStatus, updatedAt, [scope+storeId], [scope+syncStatus]";
const removedLegacyStores = Object.fromEntries([
    "legacy_products", "legacy_sales", "legacy_billing_metadata", "legacy_sync_jobs",
    "legacy_held_orders", "legacy_customers", "legacy_payment_methods", "legacy_print_jobs",
    "legacy_printers", "legacy_restaurant_tables", "legacy_service_users", "legacy_waybill_jobs",
    "legacy_orders", "legacy_refunds", "legacy_product_batches", "legacy_scrap_purchase_jobs",
    "legacy_tax_rates",
].map((name) => [name, null]));

export class PosIndexedDb extends Dexie {
    constructor(databaseName: string, collections: readonly CollectionName[]) {
        super(databaseName);
        const localStores = Object.fromEntries(collections.map((name) => [name, indexes]));
        this.version(1).stores(localStores);
        this.version(2).stores(localStores);
        // Version 3 removes the temporary legacy_* stores from databases that
        // were opened by the transitional dual-store implementation.
        this.version(3).stores({ ...localStores, ...removedLegacyStores });
    }

    records<T extends LocalRecord = LocalRecord>(
        name: CollectionName,
    ): Table<T, string> {
        return this.table<T, string>(name);
    }
}

export async function clearIndexedDbLocalData(
    databaseName: string,
    collections: readonly CollectionName[],
): Promise<void> {
    const database = new PosIndexedDb(databaseName, collections);
    await database.open();
    await database.transaction("rw", database.tables, async () => {
        await Promise.all(database.tables.map((table) => table.clear()));
    });
    database.close();
}
