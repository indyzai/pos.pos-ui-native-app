import {
    createScopeKey,
    type CollectionName,
    type LocalDatabase,
    type LocalRecord,
} from "./types";
import { applyBootstrapCollections, replaceLocalPayloads } from "./projections";

export interface BootstrapProduct {
    id: string;
    name: string;
    category: string;
    categoryType?: "INVENTORY" | "BILL" | "SCRAP" | "SERVICE";
    price: number;
    stock: number;
    emoji: string;
    color: string;
    quick?: boolean;
    barcode?: string;
    sku?: string;
    imageUrl?: string;
    taxRate?: number;
    details?: Record<string, unknown>;
}

export interface BootstrapCustomer {
    id: string;
    name: string;
    type: "CUSTOMER";
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    balance?: number;
    creditLimit?: number;
}

export interface BootstrapBankAccount {
    id: number;
    accountName: string;
    bankName: string;
    upiId?: string;
    isDefault: boolean;
    isActive: boolean;
}

export interface BootstrapPaymentMethod {
    id: string;
    name: string;
    code: string;
    icon?: string;
    isActive: boolean;
    isQuickAccess: boolean;
    isBankRelated: boolean;
    bankAccountIds: number[];
    defaultBankAccountId?: number;
    bankAccounts: BootstrapBankAccount[];
}

export interface BootstrapServiceUser {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    specialization?: string;
    isActive?: boolean;
}

export interface BootstrapTaxRate {
    id: string;
    name: string;
    percentage: number;
    isActive: boolean;
}

export interface BootstrapProductBatch {
    id: string;
    productId: string;
    batchNumber: string;
    stock: number;
    expiryDate?: string;
    price?: number;
    manufacturer?: string;
    schedule?: string;
    prescriptionRequired?: boolean;
}

export interface NormalizedBootstrapResult {
    products: BootstrapProduct[];
    customers: BootstrapCustomer[];
    paymentMethods: BootstrapPaymentMethod[];
    serviceUsers: BootstrapServiceUser[];
    taxRates: BootstrapTaxRate[];
    productBatches: BootstrapProductBatch[];
}

export function mapBootstrapProduct(
    raw: Record<string, unknown>,
): BootstrapProduct {
    const details = (raw.details ?? {}) as Record<string, unknown>;
    return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        price: Number(raw.price ?? 0),
        stock: Number(raw.stock ?? 0),
        barcode: raw.barcode ? String(raw.barcode) : undefined,
        sku: raw.sku ? String(raw.sku) : undefined,
        imageUrl: (raw.image || raw.imageUrl)
            ? String(raw.image || raw.imageUrl)
            : undefined,
        category: String(raw.category || "Uncategorized"),
        categoryType: raw.categoryType
            ? (String(raw.categoryType) as BootstrapProduct["categoryType"])
            : undefined,
        taxRate: Number(raw.taxRate || 0),
        emoji: "📦",
        color: "#E7EDFF",
        quick:
            details.isQuickItem === true ||
            details.isFavorite === true ||
            raw.quick === true,
        details: Object.keys(details).length > 0 ? details : undefined,
    };
}

export function mapBootstrapCustomer(
    raw: Record<string, unknown>,
): BootstrapCustomer {
    return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        type: "CUSTOMER",
        phone:
            String(raw.phone || raw.contactNumber || "") || undefined,
        email: String(raw.email || "") || undefined,
        gstin: String(raw.gstin || "") || undefined,
        address:
            String(raw.address || raw.addressLine || "") || undefined,
        creditLimit:
            raw.creditLimit == null ? undefined : Number(raw.creditLimit),
        balance: raw.balance == null ? undefined : Number(raw.balance),
    };
}

export function mapBootstrapPaymentMethod(
    raw: Record<string, unknown>,
): BootstrapPaymentMethod {
    return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        code: String(raw.code ?? "").toUpperCase(),
        icon: raw.icon ? String(raw.icon) : undefined,
        isActive: raw.isActive !== false,
        isQuickAccess: raw.isQuickAccess === true,
        isBankRelated: raw.isBankRelated === true,
        bankAccountIds: Array.isArray(raw.bankAccountIds)
            ? raw.bankAccountIds.map(Number)
            : [],
        defaultBankAccountId:
            raw.defaultBankAccountId == null
                ? undefined
                : Number(raw.defaultBankAccountId),
        bankAccounts: Array.isArray(raw.bankAccounts)
            ? raw.bankAccounts.map((account: Record<string, unknown>) => ({
                  id: Number(account.id),
                  accountName: String(account.accountName ?? ""),
                  bankName: String(account.bankName ?? ""),
                  upiId: account.upiId ? String(account.upiId) : undefined,
                  isDefault: account.isDefault === true,
                  isActive: account.isActive !== false,
              }))
            : [],
    };
}

export function mapBootstrapServiceUser(
    raw: Record<string, unknown>,
): BootstrapServiceUser {
    return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        phone: raw.phone ? String(raw.phone) : undefined,
        email: raw.email ? String(raw.email) : undefined,
        specialization: raw.specialization
            ? String(raw.specialization)
            : undefined,
        isActive: raw.isActive !== false,
    };
}

export function mapBootstrapTaxRate(
    raw: Record<string, unknown>,
): BootstrapTaxRate {
    return {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        percentage: Math.max(0, Number(raw.rate ?? raw.percentage ?? 0)),
        isActive: raw.isActive !== false,
    };
}

export function normalizeProductBatches(
    products: readonly BootstrapProduct[],
): BootstrapProductBatch[] {
    const batches: BootstrapProductBatch[] = [];
    for (const product of products) {
        const details = product.details as
            | {
                  batches?: Array<{
                      id?: string | number;
                      batchNumber: string;
                      expiryDate?: string;
                      stock?: number;
                      price?: number;
                      manufacturer?: string;
                      schedule?: string;
                      prescriptionRequired?: boolean;
                  }>;
                  batchNumber?: string;
                  expiryDate?: string;
                  manufacturer?: string;
                  schedule?: string;
                  prescriptionRequired?: boolean;
              }
            | undefined;

        if (Array.isArray(details?.batches) && details.batches.length > 0) {
            for (const batch of details.batches) {
                batches.push({
                    id: String(batch.id || `${product.id}-${batch.batchNumber}`),
                    productId: product.id,
                    batchNumber: batch.batchNumber,
                    stock: Number(batch.stock ?? product.stock ?? 0),
                    expiryDate: batch.expiryDate,
                    price: batch.price == null ? undefined : Number(batch.price),
                    manufacturer: batch.manufacturer,
                    schedule: batch.schedule,
                    prescriptionRequired: batch.prescriptionRequired,
                });
            }
        } else if (details?.batchNumber) {
            batches.push({
                id: `${product.id}-${details.batchNumber}`,
                productId: product.id,
                batchNumber: details.batchNumber,
                stock: Number(product.stock ?? 0),
                expiryDate: details.expiryDate,
                price: product.price,
                manufacturer: details.manufacturer,
                schedule: details.schedule,
                prescriptionRequired: details.prescriptionRequired,
            });
        }
    }
    return batches;
}

export function normalizeBootstrapCollections(
    collections: Record<string, readonly Record<string, unknown>[]>,
): NormalizedBootstrapResult {
    const products = "products" in collections
        ? (collections.products || [])
              .filter((item) => item.categoryType !== "SCRAP")
              .map(mapBootstrapProduct)
        : [];
    const customers = "customers" in collections
        ? (collections.customers || [])
              .filter(
                  (item) =>
                      String(item.type ?? "CUSTOMER").toLowerCase() ===
                      "customer",
              )
              .map(mapBootstrapCustomer)
        : [];
    const paymentMethods = "paymentMethods" in collections
        ? (collections.paymentMethods || [])
              .filter((item) => item.isActive !== false)
              .map(mapBootstrapPaymentMethod)
        : [];
    const serviceUsers = "serviceUsers" in collections
        ? (collections.serviceUsers || []).map(mapBootstrapServiceUser)
        : [];
    const taxRates = "taxRates" in collections
        ? (collections.taxRates || [])
              .filter(
                  (item) =>
                      item.isActive !== false &&
                      Number.isFinite(Number(item.rate ?? item.percentage)),
              )
              .map(mapBootstrapTaxRate)
        : [];
    const productBatches = "products" in collections
        ? normalizeProductBatches(products)
        : [];

    return {
        products,
        customers,
        paymentMethods,
        serviceUsers,
        taxRates,
        productBatches,
    };
}

/**
 * Normalizes bootstrap collections and applies them transactionally to the local database,
 * recording sync_state for each collection (including product_batches).
 */
export async function applyPosBootstrap(
    database: LocalDatabase,
    rawCollections: Record<string, readonly Record<string, unknown>[]>,
    loadedAt: number | string = Date.now(),
): Promise<NormalizedBootstrapResult> {
    const normalized = normalizeBootstrapCollections(rawCollections);
    const projectedRows: Record<string, readonly Record<string, unknown>[]> = {
        ...rawCollections,
    };

    if ("products" in rawCollections)
        projectedRows.products = normalized.products as unknown as readonly Record<string, unknown>[];
    if ("customers" in rawCollections)
        projectedRows.customers = normalized.customers as unknown as readonly Record<string, unknown>[];
    if ("paymentMethods" in rawCollections)
        projectedRows.paymentMethods = normalized.paymentMethods as unknown as readonly Record<string, unknown>[];
    if ("serviceUsers" in rawCollections)
        projectedRows.serviceUsers = normalized.serviceUsers as unknown as readonly Record<string, unknown>[];
    if ("taxRates" in rawCollections)
        projectedRows.taxRates = normalized.taxRates as unknown as readonly Record<string, unknown>[];

    await applyBootstrapCollections(database, projectedRows, loadedAt);

    if ("products" in rawCollections) {
        await replaceLocalPayloads(
            database,
            "product_batches",
            normalized.productBatches,
        );

        const timestamp =
            typeof loadedAt === "string"
                ? Date.parse(loadedAt) || Date.now()
                : loadedAt;
        try {
            const state = database.collection<
                LocalRecord<{ collection: string; lastSyncedAt: number }>
            >("sync_state");
            const scopeKey = createScopeKey(database.scope);
            await state.put({
                id: `${scopeKey}:sync_state:product_batches`,
                scope: scopeKey,
                tenantId: database.scope.tenantId,
                storeId: database.scope.storeIds[0] ?? null,
                remoteId: "product_batches",
                payload: {
                    collection: "product_batches",
                    lastSyncedAt: timestamp,
                },
                serverVersion: 0,
                syncStatus: "API",
                updatedAt: timestamp,
                deletedAt: null,
            });
        } catch {
            // sync_state store may not be configured in specialized scopes
        }
    }

    return normalized;
}
