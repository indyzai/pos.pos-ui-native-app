export const posRoles = [
    "cashier",
    "manager",
    "admin",
    "owner",
    "superadmin",
] as const;
export type PosRole = (typeof posRoles)[number];
export type DatabaseAppProfile = "store" | "admin";

export type SyncStatus =
    "API" | "SYNCED" | "PENDING" | "RUNNING" | "FAILED" | "CONFLICT";

export type DatabaseScope = {
    appProfile?: DatabaseAppProfile;
    tenantId: string;
    userId: string;
    role: PosRole;
    storeIds: readonly string[];
    deviceId: string;
    counterId?: string;
};

export type LocalRecord<T = Record<string, unknown>> = {
    id: string;
    scope: string;
    tenantId: string;
    storeId?: string | null;
    remoteId?: string | null;
    payload: T;
    serverVersion: number;
    syncStatus: SyncStatus;
    updatedAt: number;
    deletedAt?: number | null;
};

export type LocalQuery = {
    storeId?: string;
    syncStatus?: SyncStatus;
    includeDeleted?: boolean;
    limit?: number;
};

export interface CollectionRepository<T extends LocalRecord = LocalRecord> {
    get(id: string): Promise<T | undefined>;
    list(query?: LocalQuery): Promise<T[]>;
    put(record: T): Promise<void>;
    putMany(records: readonly T[]): Promise<void>;
    remove(id: string): Promise<void>;
    replace(records: readonly T[]): Promise<void>;
    subscribe(listener: () => void): () => void;
}

export const collectionNames = [
    "organizations",
    "stores",
    "devices",
    "counters",
    "users",
    "role_permissions",
    "app_settings",
    "feature_flags",
    "categories",
    "brands",
    "products",
    "product_barcodes",
    "product_uoms",
    "product_prices",
    "price_lists",
    "tax_rates",
    "product_batches",
    "modifier_groups",
    "product_modifiers",
    "service_users",
    "stock_locations",
    "stock_balances",
    "stock_movements",
    "stock_counts",
    "stock_count_lines",
    "transfers",
    "transfer_lines",
    "suppliers",
    "purchase_orders",
    "purchase_order_lines",
    "goods_receipts",
    "goods_receipt_lines",
    "scrap_purchase_jobs",
    "waybill_jobs",
    "customers",
    "customer_addresses",
    "customer_credit_summaries",
    "customer_loyalty_summaries",
    "carts",
    "cart_lines",
    "held_orders",
    "held_order_lines",
    "sales",
    "sale_lines",
    "payments",
    "payment_methods",
    "orders",
    "refunds",
    "refund_lines",
    "restaurant_tables",
    "prescription_contexts",
    "serialized_item_assignments",
    "shifts",
    "cash_drawers",
    "cash_transactions",
    "currency_denominations",
    "expense_categories",
    "expenses",
    "printers",
    "print_templates",
    "print_jobs",
    "sync_outbox",
    "sync_dependencies",
    "sync_state",
    "sync_conflicts",
    "sync_errors",
    "tombstones",
] as const;

export type CollectionName = (typeof collectionNames)[number];

export interface LocalDatabase {
    readonly kind: "sqlite" | "indexeddb";
    readonly scope: DatabaseScope;
    collection<T extends LocalRecord = LocalRecord>(
        name: CollectionName,
    ): CollectionRepository<T>;
    transaction<T>(
        collections: readonly CollectionName[],
        work: () => Promise<T> | T,
    ): Promise<T>;
    purgeDisallowed(allowed: ReadonlySet<CollectionName>): Promise<void>;
    clear(): Promise<void>;
    close(): Promise<void>;
}

export function normalizePosRole(value: unknown): PosRole {
    const role = String(value ?? "")
        .trim()
        .toLowerCase();
    return posRoles.includes(role as PosRole) ? (role as PosRole) : "cashier";
}

export function createScopeKey(scope: DatabaseScope): string {
    const stores = [...scope.storeIds].sort().join(",");
    return `pos:v1:${scope.tenantId}:${scope.userId}:${scope.role}:${stores}:${scope.deviceId}:${scope.counterId ?? ""}`;
}
