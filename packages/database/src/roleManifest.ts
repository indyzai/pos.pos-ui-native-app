import type { CollectionName, DatabaseScope, PosRole } from "./types";

const base: CollectionName[] = [
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
    "customers",
    "customer_addresses",
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
    "printers",
    "print_templates",
    "print_jobs",
    "sync_outbox",
    "sync_dependencies",
    "sync_state",
    "sync_conflicts",
    "sync_errors",
    "tombstones",
];

const management: CollectionName[] = [
    "stock_movements",
    "stock_counts",
    "stock_count_lines",
    "transfers",
    "transfer_lines",
    "customer_credit_summaries",
    "expense_categories",
    "expenses",
    "waybill_jobs",
];

const administration: CollectionName[] = [
    "suppliers",
    "purchase_orders",
    "purchase_order_lines",
    "goods_receipts",
    "goods_receipt_lines",
    "scrap_purchase_jobs",
];

const roleCollections: Record<PosRole, readonly CollectionName[]> = {
    cashier: base,
    manager: [...base, ...management],
    admin: [...base, ...management, ...administration],
    owner: [...base, ...management, ...administration],
    superadmin: [...base, ...management, ...administration],
};

export type RoleDataManifest = {
    role: PosRole;
    collections: ReadonlySet<CollectionName>;
    detailMode: "own-shift" | "store" | "assigned-stores" | "on-demand";
};

export function getRoleDataManifest(scope: DatabaseScope): RoleDataManifest {
    const detailMode =
        scope.role === "cashier"
            ? "own-shift"
            : scope.role === "manager"
              ? "store"
              : scope.role === "admin"
                ? "assigned-stores"
                : "on-demand";
    return {
        role: scope.role,
        collections: new Set(roleCollections[scope.role]),
        detailMode,
    };
}

export function assertCollectionAllowed(
    scope: DatabaseScope,
    collection: CollectionName,
): void {
    if (!getRoleDataManifest(scope).collections.has(collection)) {
        throw new Error(
            `${scope.role} cannot provision local collection ${collection}.`,
        );
    }
}
