import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const scopedEntity = (name: string) =>
    sqliteTable(
        name,
        {
            id: text().primaryKey(),
            scope: text().notNull(),
            tenantId: text('tenant_id').notNull(),
            storeId: text('store_id'),
            remoteId: text('remote_id'),
            payload: text().notNull().default('{}'),
            serverVersion: integer('server_version').notNull().default(0),
            syncStatus: text('sync_status').notNull().default('SYNCED'),
            updatedAt: integer('updated_at').notNull(),
            deletedAt: integer('deleted_at'),
        },
        (table) => [
            index(`${name}_scope_idx`).on(table.scope),
            index(`${name}_tenant_store_idx`).on(table.tenantId, table.storeId),
            index(`${name}_scope_updated_idx`).on(table.scope, table.updatedAt),
        ],
    );

const childEntity = (name: string, parentColumn: string) =>
    sqliteTable(
        name,
        {
            id: text().primaryKey(),
            scope: text().notNull(),
            tenantId: text('tenant_id').notNull(),
            storeId: text('store_id'),
            parentId: text(parentColumn).notNull(),
            remoteId: text('remote_id'),
            payload: text().notNull().default('{}'),
            serverVersion: integer('server_version').notNull().default(0),
            syncStatus: text('sync_status').notNull().default('SYNCED'),
            updatedAt: integer('updated_at').notNull(),
            deletedAt: integer('deleted_at'),
        },
        (table) => [
            index(`${name}_scope_parent_idx`).on(table.scope, table.parentId),
            index(`${name}_tenant_store_idx`).on(table.tenantId, table.storeId),
        ],
    );

// Core and access
export const organizations = scopedEntity('organizations');
export const stores = scopedEntity('stores');
export const devices = scopedEntity('devices');
export const counters = scopedEntity('counters');
export const users = scopedEntity('users');
export const rolePermissions = scopedEntity('role_permissions');
export const appSettings = scopedEntity('app_settings');
export const featureFlags = scopedEntity('feature_flags');

// Catalog and pricing
export const categories = scopedEntity('categories');
export const brands = scopedEntity('brands');
export const productBarcodes = childEntity('product_barcodes', 'product_id');
export const productUoms = childEntity('product_uoms', 'product_id');
export const productPrices = childEntity('product_prices', 'product_id');
export const priceLists = scopedEntity('price_lists');
export const modifierGroups = scopedEntity('modifier_groups');
export const productModifiers = childEntity('product_modifiers', 'product_id');

// Inventory and purchasing
export const stockLocations = scopedEntity('stock_locations');
export const stockBalances = scopedEntity('stock_balances');
export const stockMovements = scopedEntity('stock_movements');
export const stockCounts = scopedEntity('stock_counts');
export const stockCountLines = childEntity('stock_count_lines', 'stock_count_id');
export const transfers = scopedEntity('transfers');
export const transferLines = childEntity('transfer_lines', 'transfer_id');
export const suppliers = scopedEntity('suppliers');
export const purchaseOrders = scopedEntity('purchase_orders');
export const purchaseOrderLines = childEntity('purchase_order_lines', 'purchase_order_id');
export const goodsReceipts = scopedEntity('goods_receipts');
export const goodsReceiptLines = childEntity('goods_receipt_lines', 'goods_receipt_id');

// Customer projections
export const customerAddresses = childEntity('customer_addresses', 'customer_id');
export const customerCreditSummaries = scopedEntity('customer_credit_summaries');
export const customerLoyaltySummaries = scopedEntity('customer_loyalty_summaries');

// Sales, payments, and returns
export const carts = scopedEntity('carts');
export const cartLines = childEntity('cart_lines', 'cart_id');
export const heldOrderLines = childEntity('held_order_lines', 'held_order_id');
export const saleLines = childEntity('sale_lines', 'sale_id');
export const payments = scopedEntity('payments');
export const refundLines = childEntity('refund_lines', 'refund_id');
export const prescriptionContexts = scopedEntity('prescription_contexts');
export const serializedItemAssignments = scopedEntity('serialized_item_assignments');

// Shifts, cash, and expenses
export const shifts = scopedEntity('shifts');
export const cashDrawers = scopedEntity('cash_drawers');
export const cashTransactions = scopedEntity('cash_transactions');
export const currencyDenominations = scopedEntity('currency_denominations');
export const expenseCategories = scopedEntity('expense_categories');
export const expenses = scopedEntity('expenses');

// Printing
export const printTemplates = scopedEntity('print_templates');

// Sync and operational metadata
export const syncOutbox = sqliteTable(
    'sync_outbox',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        tenantId: text('tenant_id').notNull(),
        storeId: text('store_id'),
        offlineId: text('offline_id').notNull(),
        idempotencyKey: text('idempotency_key').notNull(),
        entityType: text('entity_type').notNull(),
        operation: text().notNull(),
        payload: text().notNull(),
        baseServerVersion: integer('base_server_version'),
        status: text().notNull().default('PENDING'),
        attemptCount: integer('attempt_count').notNull().default(0),
        nextAttemptAt: integer('next_attempt_at'),
        leaseExpiresAt: integer('lease_expires_at'),
        errorMessage: text('error_message'),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [
        index('sync_outbox_scope_status_idx').on(table.scope, table.status),
        index('sync_outbox_scope_next_attempt_idx').on(table.scope, table.nextAttemptAt),
        index('sync_outbox_idempotency_idx').on(table.idempotencyKey),
    ],
);

export const syncDependencies = sqliteTable(
    'sync_dependencies',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        jobId: text('job_id').notNull(),
        dependsOnJobId: text('depends_on_job_id').notNull(),
    },
    (table) => [index('sync_dependencies_job_idx').on(table.scope, table.jobId)],
);

export const syncState = sqliteTable(
    'sync_state',
    {
        id: text().primaryKey(),
        scope: text().notNull(),
        collection: text().notNull(),
        cursor: text(),
        lastSyncedAt: integer('last_synced_at'),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [index('sync_state_scope_collection_idx').on(table.scope, table.collection)],
);

export const syncConflicts = scopedEntity('sync_conflicts');
export const syncErrors = scopedEntity('sync_errors');
export const tombstones = scopedEntity('tombstones');

export const schemaMetadata = sqliteTable('schema_metadata', {
    key: text().primaryKey(),
    value: text().notNull(),
    updatedAt: integer('updated_at').notNull(),
});

export const posCollections = {
    organizations,
    stores,
    devices,
    counters,
    users,
    rolePermissions,
    appSettings,
    featureFlags,
    categories,
    brands,
    productBarcodes,
    productUoms,
    productPrices,
    priceLists,
    modifierGroups,
    productModifiers,
    stockLocations,
    stockBalances,
    stockMovements,
    stockCounts,
    stockCountLines,
    transfers,
    transferLines,
    suppliers,
    purchaseOrders,
    purchaseOrderLines,
    goodsReceipts,
    goodsReceiptLines,
    customerAddresses,
    customerCreditSummaries,
    customerLoyaltySummaries,
    carts,
    cartLines,
    heldOrderLines,
    saleLines,
    payments,
    refundLines,
    prescriptionContexts,
    serializedItemAssignments,
    shifts,
    cashDrawers,
    cashTransactions,
    currencyDenominations,
    expenseCategories,
    expenses,
    printTemplates,
    syncOutbox,
    syncDependencies,
    syncState,
    syncConflicts,
    syncErrors,
    tombstones,
    schemaMetadata,
} as const;
