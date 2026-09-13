import { getActiveWebDatabase } from "./activeDatabase";
import { createScopeKey, type CollectionName, type LocalRecord } from "../types";

type BillingSnapshot = { products: { id: string; [key: string]: any }[]; session: any; queue: { id: string; [key: string]: any }[]; updated?: string };
export const webStores = {
    products: "products", sales: "sales", metadata: "app_settings", syncJobs: "sync_errors",
    heldOrders: "held_orders", customers: "customers", paymentMethods: "payment_methods",
    printJobs: "print_jobs", printers: "printers", restaurantTables: "restaurant_tables",
    serviceUsers: "service_users", waybillJobs: "waybill_jobs", orders: "orders", refunds: "refunds",
    productBatches: "product_batches", scrapPurchaseJobs: "scrap_purchase_jobs", taxRates: "tax_rates",
} as const satisfies Record<string, CollectionName>;
export type WebSyncJob = { storageId: string; id: string; scope: string; operation: "CREATE_PRODUCT" | "UPDATE_STOCK"; entityId?: string; status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"; errorMessage?: string; createdAt: string; updatedAt: string };

const db = () => getActiveWebDatabase();
const key = (collection: CollectionName, id: string) => `${createScopeKey(db().scope)}:${collection}:${id}`;
function record<T extends { id: string }>(collection: CollectionName, value: T): LocalRecord<T> {
    const database = db();
    const status = String((value as any).status ?? "").toUpperCase();
    return { id: key(collection, value.id), scope: createScopeKey(database.scope), tenantId: database.scope.tenantId,
        storeId: database.scope.storeIds[0] ?? null, remoteId: value.id, payload: value, serverVersion: 0,
        syncStatus: status === "FAILED" ? "FAILED" : status === "PENDING" || status === "RUNNING" ? "PENDING" : "API",
        updatedAt: Date.parse(String((value as any).updatedAt ?? (value as any).createdAt ?? "")) || Date.now(), deletedAt: null };
}

/** Kept as a compatibility no-op while feature repositories move to LocalDatabase directly. */
export function configureWebDatabaseProfile(): void {}
export async function readWebBillingSnapshot<T = BillingSnapshot>(_scope: string): Promise<T | undefined> {
    const database = db();
    const [products, sales, metadata] = await Promise.all([
        database.collection("products").list(), database.collection("sales").list({ includeDeleted: true }),
        database.collection("app_settings").get(key("app_settings", "billing-metadata")),
    ]);
    if (!metadata && !products.length && !sales.length) return undefined;
    return { products: products.map((item) => item.payload), queue: sales.filter((item) => ["PENDING", "FAILED", "RUNNING"].includes(item.syncStatus)).map((item) => item.payload), session: (metadata?.payload as any)?.session ?? null, updated: (metadata?.payload as any)?.updated } as T;
}
export async function writeWebBillingSnapshot(_scope: string, snapshot: BillingSnapshot): Promise<void> {
    const database = db();
    const existing = await database.collection("sales").list({ includeDeleted: true });
    const serverSales = existing.filter((item) => item.syncStatus === "API" || item.syncStatus === "SYNCED");
    await database.collection("sales").replace([...serverSales, ...snapshot.queue.map((item) => record("sales", item))]);
    await database.collection("app_settings").put(record("app_settings", { id: "billing-metadata", session: snapshot.session, updated: snapshot.updated }));
}
export async function readWebSyncJobs(_scope: string): Promise<WebSyncJob[]> { return (await db().collection("sync_errors").list({ includeDeleted: true })).map((item) => item.payload as WebSyncJob); }
export async function writeWebSyncJob(job: WebSyncJob): Promise<void> { await db().collection("sync_errors").put(record("sync_errors", job)); }
export async function readWebHeldOrders<T>(_scope: string): Promise<T[]> { return (await db().collection("held_orders").list()).map((item) => item.payload as T); }
export async function writeWebHeldOrder<T extends { id: string }>(_scope: string, value: T): Promise<void> { await db().collection("held_orders").put(record("held_orders", value)); }
export async function deleteWebHeldOrder(_scope: string, id: string): Promise<void> { await db().collection("held_orders").remove(key("held_orders", id)); }
export async function readWebScopedRecords<T>(name: CollectionName, _scope: string): Promise<T[]> { return (await db().collection(name).list({ includeDeleted: true })).map((item) => item.payload as T); }
export async function replaceWebScopedRecords<T extends { id: string }>(name: CollectionName, _scope: string, values: T[]): Promise<void> { await db().collection(name).replace(values.map((value) => record(name, value))); }
export async function readWebPrintJobs<T>(_scope: string): Promise<T[]> { return (await db().collection("print_jobs").list({ includeDeleted: true })).map((item) => item.payload as T); }
export async function writeWebPrintJob<T extends { id: string }>(_scope: string, value: T): Promise<void> { await db().collection("print_jobs").put(record("print_jobs", value)); }
export async function clearWebLocalData(): Promise<void> { await db().clear(); }
