import type { FeatureRequest } from "@indyzai/pos-application";
import {
    applyBootstrapCollections,
    getActiveDatabase,
    type LocalRecord,
} from "@indyzai/pos-database";
import { getActiveAuthSession } from "@indyzai/pos-auth/session";
import { createReconciliationReportVariables } from "@indyzai/feature-inventory/reconciliation";
import type {
    CreateInventoryItemInput,
    ProductReferenceData,
    StockReconciliationInput,
    StockReconciliationReportInput,
    UpdateInventoryItemInput,
} from "@indyzai/feature-inventory/types";
import {
    createOutboxJob,
    listOutboxJobs,
    updateOutboxJob,
    type OutboxJob,
} from "@indyzai/pos-database/outbox-jobs";

const reconciliationMutation = `
  mutation RecordInventoryReconciliation($input: InventoryReconciliationInput!) {
    recordInventoryReconciliation(input: $input) {
      id
      stockBefore
      stockAfter
      product { id name price quantity barcode category { name } tax { percentage rate } }
    }
  }
`;

const saveReconciliationDraftMutation = `
  mutation SaveInventoryReconciliationDraft($input: InventoryReconciliationInput!) {
    saveInventoryReconciliationDraft(input: $input)
  }
`;

const reconciliationDraftsQuery = `
  query InventoryReconciliationDrafts {
    inventoryReconciliationDrafts {
      id status items { productId countedQuantity }
      reference remarks reconciliationDate sharedWithCashiers
      createdBy ownedByCurrentUser createdAt updatedAt
    }
  }
`;

const createProductMutation = `
  mutation CreateProduct($newProductData: NewProductInput!) {
    newProduct(newProductData: $newProductData) { success message errors product { id } }
  }
`;

const updateProductMutation = `
  mutation UpdateProduct($id: String!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) { success message errors product { id } }
  }
`;

const productReferencesQuery = `
  query InventoryProductReferences {
    categories(type: "INVENTORY", skip: 0, take: 200) { id name isActive }
    units { id name code }
    taxes { id name percentage isActive }
  }
`;

export function createInventoryApi(options: {
    request: FeatureRequest;
    scopeKey: (userId: string, tenantId: string) => string;
    billing: {
        load: () => Promise<{ key: string; cache: { updated?: string } }>;
        refresh: (signal?: AbortSignal) => Promise<unknown>;
    };
}) {
    const requestPos: FeatureRequest = async <T>(
        token: string,
        tenant: string,
        query: string,
        variables?: Record<string, unknown>,
        signal?: AbortSignal,
    ): Promise<T> => {
        const session = context();
        const database = getActiveDatabase();
        const assertCurrent = () => {
            const current = context();
            if (
                current.token !== token ||
                String(current.tenant.id) !== tenant ||
                String(current.user.id) !== String(session.user.id) ||
                database !== getActiveDatabase()
            )
                throw new Error("Your workspace changed. Please retry.");
        };
        assertCurrent();
        const result = await options.request<T>(
            token,
            tenant,
            query,
            variables,
            signal,
        );
        assertCurrent();
        return result;
    };
    const billingApi = options.billing;

    function context() {
        const session = getActiveAuthSession();
        if (!session)
            throw new Error(
                "Your workspace is still initializing. Please try again.",
            );
        return session;
    }

    const scope = () => {
        const session = context();
        return options.scopeKey(
            String(session.user.id),
            String(session.tenant.id),
        );
    };

    async function runTracked(
        operation: OutboxJob["operation"],
        request: () => Promise<string | undefined>,
    ): Promise<OutboxJob> {
        let job = await createOutboxJob(scope(), operation);
        job = await updateOutboxJob(job, "RUNNING");
        try {
            const entityId = await request();
            return await updateOutboxJob(job, "COMPLETED", { entityId });
        } catch (reason) {
            const errorMessage =
                reason instanceof Error
                    ? reason.message
                    : "The operation failed.";
            await updateOutboxJob(job, "FAILED", { errorMessage });
            throw reason;
        }
    }

    return {
        load: billingApi.load,
        listJobs: () => listOutboxJobs(scope()),
        refresh: (signal?: AbortSignal) => billingApi.refresh(signal),
        async loadReconciliationDrafts() {
            const session = context();
            const data = await requestPos<{
                inventoryReconciliationDrafts: Array<{
                    id: string;
                    status: "DRAFT";
                    items: Array<{
                        productId: string;
                        countedQuantity: number;
                    }>;
                    reference?: string;
                    remarks?: string;
                    reconciliationDate: string;
                    sharedWithCashiers: boolean;
                    createdBy: string;
                    ownedByCurrentUser: boolean;
                    createdAt: string;
                    updatedAt?: string;
                }>;
            }>(
                session.token,
                String(session.tenant.id),
                reconciliationDraftsQuery,
            );
            return data.inventoryReconciliationDrafts;
        },
        async loadProductReferences(
            forceRefresh = false,
        ): Promise<ProductReferenceData> {
            const session = context();
            const tenantId = String(session.tenant.id);
            const database = getActiveDatabase();
            if (!database)
                throw new Error("Your local workspace is still initializing.");
            type Reference = {
                id: string;
                name: string;
                code?: string;
                percentage?: number;
                rate?: number;
                isActive?: boolean;
            };
            const readLocal = async (): Promise<ProductReferenceData> => {
                const [categories, units, taxes] = await Promise.all(
                    (["categories", "product_uoms", "tax_rates"] as const).map(
                        (table) =>
                            database
                                .collection<LocalRecord<Reference>>(table)
                                .list(),
                    ),
                );
                return {
                    categories: categories
                        .filter((row) => row.payload.isActive !== false)
                        .map(({ payload }) => ({
                            id: Number(payload.id),
                            name: payload.name,
                        })),
                    units: units.map(({ payload }) => ({
                        id: Number(payload.id),
                        name: payload.name,
                        code: payload.code ?? "",
                    })),
                    taxes: taxes
                        .filter((row) => row.payload.isActive !== false)
                        .map(({ payload }) => ({
                            id: Number(payload.id),
                            name: payload.name,
                            percentage: Number(
                                payload.percentage ?? payload.rate ?? 0,
                            ),
                        })),
                };
            };
            const cached = await readLocal();
            const states = await database
                .collection<LocalRecord<{ collection: string }>>("sync_state")
                .list();
            const loaded = new Set(
                states.map((state) => state.payload.collection),
            );
            if (
                !forceRefresh &&
                ["categories", "product_uoms", "tax_rates"].every((table) =>
                    loaded.has(table),
                )
            )
                return cached;
            const data = await requestPos<{
                categories: Array<{
                    id: string | number;
                    name: string;
                    isActive?: boolean;
                }>;
                units: Array<{
                    id: string | number;
                    name: string;
                    code: string;
                }>;
                taxes: Array<{
                    id: string | number;
                    name: string;
                    percentage: number;
                    isActive?: boolean;
                }>;
            }>(session.token, tenantId, productReferencesQuery).catch(
                (error) => {
                    if (
                        !forceRefresh &&
                        getActiveDatabase() === database &&
                        context().token === session.token &&
                        (cached.categories.length ||
                            cached.units.length ||
                            cached.taxes.length)
                    )
                        return null;
                    throw error;
                },
            );
            if (!data) return cached;
            if (![data.categories, data.units, data.taxes].every(Array.isArray))
                throw new Error("Product reference data is incomplete.");
            await database.transaction(
                ["categories", "product_uoms", "tax_rates", "sync_state"],
                () =>
                    applyBootstrapCollections(database, {
                        categories: data.categories,
                        units: data.units,
                        taxRates: data.taxes.map((tax) => ({
                            ...tax,
                            rate: tax.percentage,
                        })),
                    }),
            );
            return readLocal();
        },
        async create(input: CreateInventoryItemInput): Promise<OutboxJob> {
            const session = context();
            const job = await runTracked("CREATE_PRODUCT", async () => {
                const data = await requestPos<{
                    newProduct: { product?: { id: string }; message?: string };
                }>(
                    session.token,
                    String(session.tenant.id),
                    createProductMutation,
                    {
                        newProductData: {
                            name: input.name,
                            price: input.price,
                            costPrice: input.costPrice,
                            quantity: input.stock,
                            minStock: input.minStock,
                            barcode: input.barcode || undefined,
                            skuCode: input.skuCode || undefined,
                            notes: input.notes || undefined,
                            categoryId: input.categoryId,
                            category: input.category || undefined,
                            unitId: input.unitId,
                            taxId: input.taxId,
                            details: { iconKey: input.iconKey },
                            status: input.status || "ACTIVE",
                        },
                    },
                );
                if (!data.newProduct?.product?.id)
                    throw new Error(
                        data.newProduct?.message ||
                            "Server did not acknowledge the product.",
                    );
                return String(data.newProduct.product.id);
            });
            await billingApi.refresh();
            return job;
        },
        async update(input: UpdateInventoryItemInput): Promise<OutboxJob> {
            const session = context();
            const job = await runTracked("UPDATE_PRODUCT", async () => {
                const data = await requestPos<{
                    updateProduct: {
                        success: boolean;
                        product?: { id: string };
                        message?: string;
                    };
                }>(
                    session.token,
                    String(session.tenant.id),
                    updateProductMutation,
                    {
                        id: input.productId,
                        input: {
                            name: input.name,
                            price: input.price,
                            costPrice: input.costPrice,
                            quantity: input.stock,
                            minStock: input.minStock,
                            barcode: input.barcode || undefined,
                            skuCode: input.skuCode || undefined,
                            notes: input.notes || undefined,
                            categoryId: input.categoryId,
                            category: input.category || undefined,
                            unitId: input.unitId,
                            taxId: input.taxId,
                            details: { iconKey: input.iconKey },
                            status: input.status || "ACTIVE",
                        },
                    },
                );
                if (
                    !data.updateProduct?.success ||
                    !data.updateProduct.product?.id
                )
                    throw new Error(
                        data.updateProduct?.message ||
                            "Server did not acknowledge the product update.",
                    );
                return String(data.updateProduct.product.id);
            });
            await billingApi.refresh();
            return job;
        },
        async reconcileReport(
            input: StockReconciliationReportInput,
        ): Promise<OutboxJob> {
            const session = context();
            const job = await runTracked("UPDATE_STOCK", async () => {
                const data = await requestPos<{
                    recordInventoryReconciliation?: Array<{ id: string }>;
                }>(
                    session.token,
                    String(session.tenant.id),
                    reconciliationMutation,
                    createReconciliationReportVariables(input),
                );
                const movements = data.recordInventoryReconciliation;
                if (
                    !movements?.length ||
                    !movements.every((movement) => movement.id)
                )
                    throw new Error(
                        "Server did not acknowledge the stock update.",
                    );
                return movements
                    .map((movement) => String(movement.id))
                    .join(",");
            });
            await billingApi.refresh();
            return job;
        },
        async saveReconciliationDraft(
            input: StockReconciliationReportInput,
        ): Promise<OutboxJob> {
            const session = context();
            return runTracked("SAVE_STOCK_DRAFT", async () => {
                const data = await requestPos<{
                    saveInventoryReconciliationDraft?: string;
                }>(
                    session.token,
                    String(session.tenant.id),
                    saveReconciliationDraftMutation,
                    createReconciliationReportVariables(input),
                );
                if (!data.saveInventoryReconciliationDraft)
                    throw new Error(
                        "Server did not acknowledge the reconciliation draft.",
                    );
                return String(data.saveInventoryReconciliationDraft);
            });
        },
        reconcile(input: StockReconciliationInput): Promise<OutboxJob> {
            return this.reconcileReport({
                items: [
                    {
                        productId: input.productId,
                        countedQuantity: input.countedQuantity,
                    },
                ],
                reference: input.reference,
                remarks: input.remarks,
            });
        },
    };
}
export type InventoryApi = ReturnType<typeof createInventoryApi>;
