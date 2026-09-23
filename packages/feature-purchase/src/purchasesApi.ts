import {
    assertFeatureContext,
    type FeatureContext,
    type FeatureRequest,
} from "@indyzai/pos-application";
import type { LocalDatabase, LocalRecord } from "@indyzai/pos-database";
import {
    resolveTableMutation,
    type TableOutboxPayload,
} from "@indyzai/pos-database/table-mutations";
import { SerialQueue } from "@indyzai/pos-sync";
import type { PurchaseItemSplit } from "./domain";

export type PurchaseLine = {
    productId?: string;
    productName: string;
    quantity: number;
    purchasePrice: number;
    taxRate: number;
    unit?: string;
    splits?: PurchaseItemSplit[];
};
export type Purchase = {
    id: string;
    invoiceNumber?: string;
    supplierName?: string;
    status: "DRAFT" | "COMPLETED";
    items: PurchaseLine[];
    total: number;
    createdAt: string;
    scannedImages?: number;
};
type ServerPurchase = {
    id: string | number;
    billId?: string;
    purchaseNumber?: string;
    invoiceNumber?: string;
    status?: string;
    totalAmount?: number;
    purchaseDate?: string;
    createdAt?: string;
    supplierName?: string;
    items?: Array<{
        quantity?: number;
        unitPrice?: number;
        taxRate?: number;
        unit?: string;
        product?: { id: string | number; name: string };
    }>;
};
type Context = FeatureContext & { database: LocalDatabase };
const purchasesQuery = `query PosPurchases($skip: Int!, $take: Int!) {
 purchases(skip: $skip, take: $take) { id billId purchaseNumber invoiceNumber status totalAmount purchaseDate createdAt supplierName items { quantity unitPrice taxRate unit product { id name skuCode } } }
}`;
const saveMutation = `mutation SavePurchase($newPurchaseData: NewPurchaseInput!) { savePurchase(newPurchaseData: $newPurchaseData) { id purchaseNumber status } }`;

export function purchaseInput(
    purchase: Purchase,
    job: TableOutboxPayload<Purchase>,
    branchId?: string | null,
) {
    if (!purchase.supplierName?.trim())
        throw new Error("Enter a supplier before saving a purchase.");
    if (
        !purchase.items.length ||
        purchase.items.some(
            (item) =>
                !item.productName.trim() ||
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0 ||
                !Number.isFinite(item.purchasePrice) ||
                item.purchasePrice < 0 ||
                !Number.isFinite(item.taxRate) ||
                item.taxRate < 0,
        )
    )
        throw new Error(
            "Check purchase item names, quantities, prices and tax rates.",
        );
    if (job.operation === "UPDATE" && !/^\d+$/.test(purchase.id))
        throw new Error("This purchase is waiting for its original server ID.");
    return {
        ...(job.operation === "UPDATE" ? { id: Number(purchase.id) } : {}),
        clientMutationId: job.idempotencyKey,
        ...(branchId && /^\d+$/.test(branchId)
            ? { branchId: Number(branchId) }
            : {}),
        purchaseNumber: purchase.invoiceNumber,
        supplierName: purchase.supplierName,
        status: purchase.status,
        purchaseDate: purchase.createdAt,
        subtotal: purchase.items.reduce(
            (sum, item) => sum + item.quantity * item.purchasePrice,
            0,
        ),
        taxAmount: purchase.items.reduce(
            (sum, item) =>
                sum + (item.quantity * item.purchasePrice * item.taxRate) / 100,
            0,
        ),
        discountAmount: 0,
        totalAmount: purchase.total,
        items: purchase.items.map((item) => ({
            ...(item.productId && /^\d+$/.test(item.productId)
                ? { productId: Number(item.productId) }
                : {}),
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.purchasePrice,
            unit: item.unit,
            taxRate: item.taxRate,
        })),
    };
}

export function createPurchasesApi(options: {
    getContext: () => Context;
    request: FeatureRequest;
}) {
    const queue = new SerialQueue();
    const assertCurrent = (context: Context) => {
        const current = options.getContext();
        assertFeatureContext(context, current);
        if (context.database !== current.database)
            throw new Error("Your workspace changed. Please retry.");
    };
    return {
        pushPending(signal?: AbortSignal) {
            return queue.run(async () => {
                const context = options.getContext();
                const outbox =
                    context.database.collection<
                        LocalRecord<TableOutboxPayload<Purchase>>
                    >("sync_outbox");
                for (const original of await outbox.list({
                    includeDeleted: true,
                })) {
                    if (
                        original.payload.entityType !== "PURCHASE" ||
                        !["PENDING", "RUNNING"].includes(original.syncStatus) ||
                        (original.payload.attempts ?? 0) >= 3
                    )
                        continue;
                    // Earlier acknowledgements may have rewritten this job's server ID.
                    const job = await outbox.get(original.id);
                    if (!job) continue;
                    const jobs = await outbox.list({ includeDeleted: true });
                    if (
                        job.payload.dependencyJobIds.some(
                            (id) =>
                                !jobs.some(
                                    (row) =>
                                        row.payload.offlineId === id &&
                                        row.syncStatus === "SYNCED",
                                ),
                        )
                    )
                        continue;
                    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                    assertCurrent(context);
                    await outbox.put({
                        ...job,
                        syncStatus: "RUNNING",
                        updatedAt: Date.now(),
                    });
                    try {
                        if (
                            !["CREATE", "UPDATE"].includes(
                                job.payload.operation,
                            )
                        )
                            throw new Error("Unsupported purchase operation.");
                        const input = purchaseInput(
                            job.payload.data,
                            job.payload,
                            job.storeId,
                        );
                        const response = await options.request<{
                            savePurchase: {
                                id: string | number;
                                purchaseNumber?: string;
                            };
                        }>(
                            context.token,
                            context.tenant,
                            saveMutation,
                            { newPurchaseData: input },
                            signal,
                        );
                        assertCurrent(context);
                        if (!response.savePurchase?.id)
                            throw new Error(
                                "Server did not acknowledge the purchase.",
                            );
                        await resolveTableMutation(
                            context.database,
                            { table: "purchase_orders" },
                            {
                                jobId: job.payload.offlineId,
                                serverId: String(response.savePurchase.id),
                                payload: {
                                    ...job.payload.data,
                                    invoiceNumber:
                                        response.savePurchase.purchaseNumber ??
                                        job.payload.data.invoiceNumber,
                                },
                            },
                        );
                    } catch (error) {
                        assertCurrent(context);
                        const attempts = (job.payload.attempts ?? 0) + 1;
                        const errorMessage =
                            error instanceof Error
                                ? error.message
                                : "Purchase sync failed.";
                        await outbox.put({
                            ...job,
                            syncStatus: attempts >= 3 ? "FAILED" : "PENDING",
                            updatedAt: Date.now(),
                            payload: {
                                ...job.payload,
                                attempts,
                                errorMessage,
                            },
                        } as LocalRecord<TableOutboxPayload<Purchase>>);
                        throw error;
                    }
                }
            });
        },
        refresh(signal?: AbortSignal) {
            return queue.run(async () => {
                const context = options.getContext();
                const rows: ServerPurchase[] = [];
                for (let skip = 0; ; skip += 100) {
                    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                    const response = await options.request<{
                        purchases: ServerPurchase[];
                    }>(
                        context.token,
                        context.tenant,
                        purchasesQuery,
                        { skip, take: 100 },
                        signal,
                    );
                    assertCurrent(context);
                    if (!Array.isArray(response.purchases))
                        throw new Error(
                            "The purchases response is incomplete.",
                        );
                    rows.push(...response.purchases);
                    if (response.purchases.length < 100) break;
                }
                await context.database.transaction(
                    ["purchase_orders"],
                    async () => {
                        assertCurrent(context);
                        if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                        const repository =
                            context.database.collection<LocalRecord<Purchase>>(
                                "purchase_orders",
                            );
                        const current = await repository.list({
                            includeDeleted: true,
                        });
                        const records = rows.flatMap<LocalRecord<Purchase>>(
                            (row) => {
                                const remoteId = String(row.id);
                                const existing = current.find(
                                    (item) => item.remoteId === remoteId,
                                );
                                if (
                                    existing &&
                                    existing.syncStatus !== "SYNCED"
                                )
                                    return [];
                                return [
                                    {
                                        id:
                                            existing?.id ??
                                            `${context.scope}:purchase_orders:${remoteId}`,
                                        scope: context.scope,
                                        tenantId:
                                            context.database.scope.tenantId,
                                        storeId:
                                            context.database.scope
                                                .storeIds[0] ?? null,
                                        remoteId,
                                        serverVersion:
                                            existing?.serverVersion ?? 0,
                                        syncStatus: "SYNCED",
                                        updatedAt: Date.now(),
                                        deletedAt: null,
                                        payload: {
                                            id: remoteId,
                                            invoiceNumber:
                                                row.invoiceNumber ||
                                                row.purchaseNumber ||
                                                row.billId ||
                                                remoteId,
                                            supplierName: row.supplierName,
                                            status:
                                                row.status === "DRAFT"
                                                    ? "DRAFT"
                                                    : "COMPLETED",
                                            total: Number(row.totalAmount ?? 0),
                                            createdAt:
                                                row.purchaseDate ||
                                                row.createdAt ||
                                                "",
                                            items: (row.items ?? []).map(
                                                (item) => ({
                                                    productId:
                                                        item.product?.id == null
                                                            ? undefined
                                                            : String(
                                                                  item.product
                                                                      .id,
                                                              ),
                                                    productName:
                                                        item.product?.name ||
                                                        "Unnamed product",
                                                    quantity: Number(
                                                        item.quantity ?? 0,
                                                    ),
                                                    purchasePrice: Number(
                                                        item.unitPrice ?? 0,
                                                    ),
                                                    taxRate: Number(
                                                        item.taxRate ?? 0,
                                                    ),
                                                    unit: item.unit,
                                                }),
                                            ),
                                        },
                                    },
                                ];
                            },
                        );
                        await repository.putMany(records);
                    },
                );
            });
        },
    };
}
