import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePathname } from "expo-router";
import { useBackgroundRefresh } from "@indyzai/pos-ui-native";
import { useLocalDatabase } from "@indyzai/pos-database/react";
import { useAuthSession } from "@indyzai/pos-auth/session";
import type { InventoryApi } from "../inventoryApi";
import type {
    CreateInventoryItemInput,
    StockReconciliationInput,
    StockReconciliationRecord,
    UpdateInventoryItemInput,
} from "@indyzai/feature-inventory/types";
import {
    createLocalFirstTableHook,
    createScopeKey,
} from "@indyzai/pos-database";
import type { LocalRecord } from "@indyzai/pos-database";
import type { Product } from "@indyzai/feature-billing/types/billing";
import { createStockReconciliationRecord } from "@indyzai/feature-inventory/reconciliation";

const useInventoryProducts = createLocalFirstTableHook<Product>({
    table: "products",
    entityType: "PRODUCT",
});
const useStockCounts = createLocalFirstTableHook<StockReconciliationRecord>({
    table: "stock_counts",
    entityType: "STOCK_RECONCILIATION",
    query: { includeDeleted: true },
});

export function useInventory(inventoryApi: InventoryApi) {
    const pathname = usePathname();
    const auth = useAuthSession();
    const local = useLocalDatabase();
    const queryClient = useQueryClient();
    const ready =
        !auth.initializing && !!auth.session && local.status === "ready";
    useBackgroundRefresh(
        ready && local.database && pathname === "/inventory"
            ? `inventory:${createScopeKey(local.database.scope)}`
            : undefined,
        (signal) => inventoryApi.refresh(signal),
    );
    const queryKey = [
        "billing-cache",
        auth.session?.user.id,
        auth.session?.tenant.id,
    ];
    const query = useQuery({
        queryKey,
        queryFn: inventoryApi.load,
        enabled: ready,
        networkMode: "always",
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
    });
    const productTable = useInventoryProducts();
    const stockCounts = useStockCounts();
    const jobs = useQuery({
        queryKey: [
            "inventory-outbox-jobs",
            auth.session?.user.id,
            auth.session?.tenant.id,
        ],
        queryFn: inventoryApi.listJobs,
        enabled: ready,
        networkMode: "always",
        refetchInterval: (result) =>
            result.state.data?.some(
                (job) => job.status === "PENDING" || job.status === "RUNNING",
            )
                ? 1000
                : false,
    });
    const refresh = useMutation({
        mutationFn: (signal?: AbortSignal) => inventoryApi.refresh(signal),
        retry: false,
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["billing-cache"] });
            void queryClient.invalidateQueries({
                queryKey: ["inventory-outbox-jobs"],
            });
        },
    });
    const reconcile = useMutation({
        mutationFn: async (input: StockReconciliationInput) => {
            if (!local.database)
                throw new Error("Local inventory database is not ready.");
            const productRecord = productTable.data.find(
                (record) => record.payload.id === input.productId,
            );
            if (!productRecord)
                throw new Error(
                    "The selected product is not available locally.",
                );
            const history = createStockReconciliationRecord(
                productRecord.payload,
                input,
                "COMPLETED",
            );
            const queued = await stockCounts.createMutation({
                payload: history,
                operation: "CREATE",
                localId: history.id,
                idempotencyKey: `stock-reconciliation:${history.id}`,
            });
            const apiJob = await inventoryApi.reconcile(input);
            await stockCounts.resolveMutation({
                jobId: queued.job.payload.offlineId,
                serverId: apiJob.entityId || apiJob.id,
                payload: history,
            });
            await local.database
                .collection<LocalRecord<Product>>("products")
                .put({
                    ...productRecord,
                    payload: {
                        ...productRecord.payload,
                        stock: input.countedQuantity,
                    },
                    updatedAt: Date.now(),
                });
            return apiJob;
        },
        retry: false,
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["billing-cache"] });
            void queryClient.invalidateQueries({
                queryKey: ["inventory-outbox-jobs"],
            });
        },
    });
    const saveDraft = async (input: StockReconciliationInput) => {
        if (!local.database)
            throw new Error("Local inventory database is not ready.");
        const productRecord = productTable.data.find(
            (record) => record.payload.id === input.productId,
        );
        if (!productRecord)
            throw new Error("The selected product is not available locally.");
        const payload = createStockReconciliationRecord(
            productRecord.payload,
            input,
            "DRAFT",
        );
        const id = payload.id;
        await local.database
            .collection<LocalRecord<StockReconciliationRecord>>("stock_counts")
            .put({
                id,
                scope: createScopeKey(local.database.scope),
                tenantId: local.database.scope.tenantId,
                storeId: local.database.scope.storeIds[0] ?? null,
                remoteId: null,
                payload,
                serverVersion: 0,
                syncStatus: "API",
                updatedAt: Date.now(),
                deletedAt: null,
            });
        await stockCounts.reload();
        return payload;
    };
    const create = useMutation({
        mutationFn: (input: CreateInventoryItemInput) =>
            inventoryApi.create(input),
        retry: false,
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["billing-cache"] });
            void queryClient.invalidateQueries({
                queryKey: ["inventory-outbox-jobs"],
            });
        },
    });
    const update = useMutation({
        mutationFn: async (input: UpdateInventoryItemInput) => {
            const job = await inventoryApi.update(input);
            await productTable.reload();
            return job;
        },
        retry: false,
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["billing-cache"] });
            void queryClient.invalidateQueries({
                queryKey: ["inventory-outbox-jobs"],
            });
        },
    });
    const error =
        refresh.error ??
        reconcile.error ??
        create.error ??
        update.error ??
        query.error;
    return useMemo(
        () => ({
            products: productTable.data.map((record) => record.payload),
            reconciliationHistory: stockCounts.data.map(
                (record) => record.payload,
            ),
            jobs: jobs.data ?? [],
            updated: query.data?.cache.updated,
            loading:
                query.isLoading || productTable.loading || stockCounts.loading,
            refreshing: refresh.isPending,
            reconciling: reconcile.isPending,
            creating: create.isPending || update.isPending,
            error:
                local.error ||
                auth.error ||
                productTable.error ||
                stockCounts.error ||
                (error instanceof Error ? error.message : ""),
            refresh: (signal?: AbortSignal) => refresh.mutateAsync(signal),
            reconcile: (input: StockReconciliationInput) =>
                reconcile.mutateAsync(input),
            saveDraft,
            create: (input: CreateInventoryItemInput) =>
                create.mutateAsync(input),
            update: (input: UpdateInventoryItemInput) =>
                update.mutateAsync(input),
        }),
        [
            auth.error,
            create,
            error,
            jobs.data,
            local.error,
            productTable,
            query.data,
            query.isLoading,
            reconcile,
            refresh,
            stockCounts,
            update,
        ],
    );
}
