import { requestPos, requestPosBootstrap, requestPosHasUpdates } from '../../core/api/posApi';
import { SerialQueue } from '@indyzai/pos-sync';
import { readBillingSnapshot, writeBillingSnapshot } from '@indyzai/feature-billing/data/billingRepository';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { fetchCatalog } from '@indyzai/feature-catalog/catalogApi';
import {
    createPendingSale,
    syncPendingSales,
    type CounterSession,
    type PendingSale,
} from '@indyzai/feature-billing/salesOutbox';
import type { CartItem, CheckoutPayment, Product } from '@indyzai/feature-billing/types/billing';
import type {
    BillingOrderContext,
    BillingPaymentMethod,
    BillingTaxRate,
    Customer,
    ServiceUser,
} from '@indyzai/feature-billing/types/billing';
import { billingReferenceRepository } from '@indyzai/feature-billing/data/billingReferenceRepository';
import type { BillingCalculationPolicy } from '@indyzai/feature-billing/domain/billingTotals';
import { requiresOpenCounter } from '@indyzai/feature-organization/organizationSettings';
import { waybillRepository } from '@indyzai/feature-orders/logistics/waybillRepository';
import { syncWaybillJobs, waybillJobFromSale } from '@indyzai/feature-orders/logistics/waybillSync';
import { productBatchRepository } from '@indyzai/feature-billing/data/productBatchRepository';
import { normalizeProductBatches } from '@indyzai/feature-billing/domain/productBatches';
import type { ProductBatch } from '@indyzai/feature-billing/types/billing';
import { scrapPurchaseRepository } from '@indyzai/feature-scrap/scrapPurchaseRepository';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '@indyzai/feature-scrap/scrapSync';
import { canManageScrap } from '@indyzai/feature-scrap/permissions';
import {
    applyPosBootstrap,
    bootstrapCollectionMap,
    getActiveDatabase,
    normalizeBootstrapCollections,
    createScopeKey,
    type LocalRecord,
    type LocalDatabase,
} from '@indyzai/pos-database';
import { getBillingBootstrapCollections, resolveBillingMode } from '@indyzai/feature-billing/domain/billingMode';
import { customersApi } from '../customers/customersApi';
import { purchasesApi } from '../purchases/purchasesApi';
import type { TableOutboxPayload } from '@indyzai/pos-database';
import { resolveTableMutation, type MutationDependency } from '@indyzai/pos-database/table-mutations';

type Context = { key: string; tenant: string; token: string };
export type BillingCache = {
    products: Product[];
    customers: Customer[];
    paymentMethods: BillingPaymentMethod[];
    serviceUsers: ServiceUser[];
    productBatches: ProductBatch[];
    taxRates: BillingTaxRate[];
    session: CounterSession | null;
    queue: PendingSale[];
    updated?: string;
};
const fallbackPaymentMethods: BillingPaymentMethod[] = [
    {
        id: 'cash',
        name: 'Cash',
        code: 'CASH',
        isActive: true,
        isQuickAccess: true,
        isBankRelated: false,
        bankAccountIds: [],
        bankAccounts: [],
    },
    {
        id: 'upi',
        name: 'UPI',
        code: 'UPI',
        isActive: true,
        isQuickAccess: true,
        isBankRelated: true,
        bankAccountIds: [],
        bankAccounts: [],
    },
    {
        id: 'card',
        name: 'Card',
        code: 'CARD',
        isActive: true,
        isQuickAccess: true,
        isBankRelated: true,
        bankAccountIds: [],
        bankAccounts: [],
    },
];
const syncQueue = new SerialQueue();
type SaleOutboxPayload = {
    offlineId: string;
    idempotencyKey: string;
    entityType: 'SALE';
    operation: 'CREATE';
    input: Record<string, unknown>;
    table?: 'sales';
    localId?: string;
    data?: PendingSale;
    dependencyJobIds?: string[];
};
const saleOutboxId = (database: LocalDatabase, offlineId: string) =>
    `${createScopeKey(database.scope)}:outbox:sale:${offlineId}`;
async function setSaleOutboxStatus(
    database: LocalDatabase,
    sale: PendingSale,
    syncStatus: 'PENDING' | 'RUNNING',
    errorMessage?: string,
) {
    const now = Date.now();
    const existing = (
        await database
            .collection<LocalRecord<SaleOutboxPayload>>('sync_outbox')
            .list({ includeDeleted: true })
    ).find(
        (record) =>
            (record.payload.table === 'sales' && record.payload.localId === sale.id) ||
            record.payload.offlineId === sale.id,
    );
    if (existing) {
        await database.collection<LocalRecord<SaleOutboxPayload>>('sync_outbox').put({
            ...existing,
            payload: {
                ...existing.payload,
                ...(errorMessage ? { errorMessage } : {}),
            },
            syncStatus,
            updatedAt: now,
        });
        return;
    }
    const payload: SaleOutboxPayload = {
        offlineId: sale.id,
        idempotencyKey: `sale:${sale.id}`,
        entityType: 'SALE',
        operation: 'CREATE',
        input: sale.input,
        table: 'sales',
        localId: sale.id,
        data: sale,
        dependencyJobIds: [],
        ...(errorMessage ? { errorMessage } : {}),
    };
    await database.collection<LocalRecord<SaleOutboxPayload>>('sync_outbox').put({
        id: saleOutboxId(database, sale.id),
        scope: createScopeKey(database.scope),
        tenantId: database.scope.tenantId,
        storeId: sale.input.branchId ? String(sale.input.branchId) : null,
        remoteId: null,
        payload,
        serverVersion: 0,
        syncStatus,
        updatedAt: now,
    });
}
function getTargetBootstrapCollections(): string[] {
    const session = getActiveAuthSession();
    const settings = session?.organization?.settings;
    const mode = resolveBillingMode(settings?.businessType, settings).mode;
    return getBillingBootstrapCollections(mode, settings).filter((collection) => collection !== 'customers');
}
async function updatedBootstrapCollections(
    c: Context,
    database: LocalDatabase,
    signal?: AbortSignal,
    collections = getTargetBootstrapCollections(),
) {
    const states = await database.collection('sync_state').list({ includeDeleted: true });
    const loadedMap = new Map(
        states.map((state) => [
            String((state.payload as { collection?: string }).collection ?? state.remoteId),
            Number((state.payload as { lastSyncedAt?: number }).lastSyncedAt),
        ]),
    );
    const missing = collections.filter(
        (col) => !loadedMap.has(col) && !loadedMap.has(bootstrapCollectionMap[col] ?? col),
    );
    const loaded = Array.from(loadedMap.values()).filter(Number.isFinite);
    if (!loaded.length) return collections;

    const result = await requestPosHasUpdates<{ updates: Record<string, boolean> }>(c.token, c.tenant, {
        since: new Date(Math.min(...loaded)).toISOString(),
        route: '/',
        collections,
        signal,
    });
    return collections.filter((collection) => result.updates[collection] || missing.includes(collection));
}
async function context(): Promise<Context> {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Your workspace is still initializing. Please try again.');
    return {
        key: appStorageKeys.pos.billing(session.user.id, session.tenant.id),
        tenant: String(session.tenant.id),
        token: session.token,
    };
}
async function read(c: Context): Promise<BillingCache> {
    const [snapshot, customers, paymentMethods, serviceUsers, productBatches, taxRates] = await Promise.all([
        readBillingSnapshot(c.key),
        billingReferenceRepository.readCustomers(c.key),
        billingReferenceRepository.readPaymentMethods(c.key),
        billingReferenceRepository.readServiceUsers(c.key),
        productBatchRepository.read(c.key),
        billingReferenceRepository.readTaxRates(c.key),
    ]);
    return {
        ...snapshot,
        products: snapshot.products.filter((product) => product.categoryType !== 'SCRAP'),
        customers: customers.filter((customer) => customer.type === 'CUSTOMER'),
        paymentMethods: paymentMethods.length ? paymentMethods : fallbackPaymentMethods,
        serviceUsers,
        productBatches,
        taxRates,
    };
}
const write = (c: Context, value: BillingCache) => writeBillingSnapshot(c.key, value);
async function request<T>(
    c: Context,
    query: string,
    variables: Record<string, unknown> = {},
    signal?: AbortSignal,
): Promise<T> {
    const assertCurrent = async () => {
        const current = await context();
        if (current.key !== c.key || current.tenant !== c.tenant || current.token !== c.token)
            throw new Error('Business changed. Please retry.');
    };
    await assertCurrent();
    const result = await requestPos<T>(c.token, c.tenant, query, variables, signal);
    await assertCurrent();
    return result;
}

export const billingApi = {
    load: async () => {
        const c = await context();
        return { key: c.key, cache: await read(c) };
    },
    loadScrapProducts: async (signal?: AbortSignal) => {
        const c = await context();
        return fetchCatalog((query, variables) => request(c, query, variables, signal), 'SCRAP');
    },
    refresh: (signal?: AbortSignal, database?: LocalDatabase | null, forceBootstrap = false) =>
        syncQueue.run(async () => {
            const c = await context();
            const targetDb = database ?? getActiveDatabase();
            await customersApi.sync(signal, targetDb).catch(() => undefined);
            const cache = await read(c);
            const targetCollections = getTargetBootstrapCollections();
            const collections =
                targetDb && !forceBootstrap
                    ? await updatedBootstrapCollections(c, targetDb, signal, targetCollections)
                    : targetCollections;
            if (!collections.length) return;
            const bootstrap = await requestPosBootstrap<{
                generatedAt: string;
                collections: Record<string, any[]>;
            }>(c.token, c.tenant, {
                route: '/',
                collections,
                limit: 1000,
                signal,
            });
            const rows = bootstrap.collections ?? {};
            const normalized = targetDb
                ? await applyPosBootstrap(targetDb, rows, bootstrap.generatedAt)
                : normalizeBootstrapCollections(rows);

            if ('products' in rows) {
                cache.products = normalized.products as Product[];
                cache.productBatches = normalized.productBatches as ProductBatch[];
            }
            if ('customers' in rows) cache.customers = normalized.customers as Customer[];
            if ('paymentMethods' in rows)
                cache.paymentMethods = normalized.paymentMethods.length
                    ? (normalized.paymentMethods as BillingPaymentMethod[])
                    : fallbackPaymentMethods;
            if ('serviceUsers' in rows) cache.serviceUsers = normalized.serviceUsers as ServiceUser[];
            if ('taxRates' in rows) cache.taxRates = normalized.taxRates as BillingTaxRate[];
            if ('counterSessions' in rows)
                cache.session = (rows.counterSessions?.[0] as CounterSession | undefined) ?? null;
            cache.updated = bootstrap.generatedAt;

            const writes: Promise<unknown>[] = [write(c, cache)];
            if ('customers' in rows)
                writes.push(billingReferenceRepository.replaceCustomers(c.key, cache.customers));
            if ('paymentMethods' in rows)
                writes.push(billingReferenceRepository.replacePaymentMethods(c.key, cache.paymentMethods));
            if ('serviceUsers' in rows)
                writes.push(billingReferenceRepository.replaceServiceUsers(c.key, cache.serviceUsers));
            if ('products' in rows) writes.push(productBatchRepository.replace(c.key, cache.productBatches));
            if ('taxRates' in rows)
                writes.push(billingReferenceRepository.replaceTaxRates(c.key, cache.taxRates));
            await Promise.all(writes);
        }),
    hasUpdates: async (database: LocalDatabase, signal?: AbortSignal) => {
        const c = await context();
        return (await updatedBootstrapCollections(c, database, signal)).length > 0;
    },
    checkout: (
        key: string,
        items: CartItem[],
        payment: CheckoutPayment,
        policy: BillingCalculationPolicy,
        orderDiscount = 0,
        customer?: Customer,
        orderContext?: BillingOrderContext,
        enqueueSale?: (sale: PendingSale, dependencies: MutationDependency[]) => Promise<unknown>,
    ) =>
        syncQueue.run(async () => {
            const c = await context();
            if (c.key !== key) throw new Error('Business changed. Start a new cart.');
            const cache = await read(c);
            const auth = getActiveAuthSession();
            const requireOpenSession = requiresOpenCounter(auth?.organization?.settings);
            const currentSession = auth?.organization ? auth.organization.activeSession : cache.session;
            const database = getActiveDatabase();
            const dependencies: MutationDependency[] = [];
            if (customer && database) {
                const customerId = customer.id;
                const rows = await database.collection<LocalRecord<Customer>>('customers').list();
                const local = rows.find((row) => row.id === customerId || row.payload.id === customerId);
                if (local) {
                    customer = {
                        ...customer,
                        id: local.remoteId && local.syncStatus === 'SYNCED' ? local.remoteId : local.id,
                    };
                    const jobs = await database
                        .collection<LocalRecord<TableOutboxPayload>>('sync_outbox')
                        .list({ includeDeleted: true });
                    const dependency = jobs.find(
                        (job) =>
                            job.payload.table === 'customers' &&
                            job.payload.localId === local.id &&
                            job.syncStatus !== 'SYNCED',
                    );
                    if (dependency) dependencies.push({ jobId: dependency.payload.offlineId });
                    else if (local.syncStatus !== 'SYNCED')
                        throw new Error(
                            'The customer is not ready to synchronize. Retry saving the customer.',
                        );
                }
            }
            const sale = createPendingSale({
                items,
                payment,
                policy,
                orderDiscount,
                session: currentSession,
                requireOpenSession,
                customer,
                invoicePrefix:
                    typeof auth?.organization?.settings?.invoicePrefix === 'string'
                        ? auth.organization.settings.invoicePrefix
                        : undefined,
                orderContext,
            });
            if (payment.scrap) {
                if (!canManageScrap(auth?.tenant.role))
                    throw new Error('Your role cannot accept scrap exchanges.');
                if (!currentSession) throw new Error('Open a counter session before accepting scrap.');
                const jobs = await scrapPurchaseRepository.read(c.key);
                jobs.push(scrapPurchaseJob(payment.scrap, currentSession, customer));
                await scrapPurchaseRepository.replace(c.key, jobs);
            }
            try {
                if (enqueueSale) {
                    await write(c, cache);
                    await enqueueSale(sale, dependencies);
                } else {
                    cache.queue.push(sale);
                    await write(c, cache); // Never clear the cart until this durable write succeeds.
                    const database = getActiveDatabase();
                    if (database) await setSaleOutboxStatus(database, sale, 'PENDING');
                }
            } catch (error) {
                if (payment.scrap) {
                    const jobs = await scrapPurchaseRepository.read(c.key);
                    await scrapPurchaseRepository.replace(
                        c.key,
                        jobs.filter((job) => job.id !== payment.scrap?.id),
                    );
                }
                throw error;
            }
            return { id: sale.id, receiptNumber: sale.receiptNumber };
        }),
    createCustomer: (key: string, input: { name: string; phone?: string; email?: string; gstin?: string }) =>
        syncQueue.run(async () => {
            const c = await context();
            if (c.key !== key) throw new Error('Business changed. Please retry.');
            return customersApi.create(input);
        }),
    sync: (signal?: AbortSignal) =>
        syncQueue.run(async () => {
            const c = await context();
            const database = getActiveDatabase();
            if (database) {
                await customersApi.pushPending(signal, database);
                await purchasesApi.pushPending(signal);
            }
            const cache = await read(c);
            const saleJobs = database
                ? (
                      await database
                          .collection<LocalRecord<SaleOutboxPayload>>('sync_outbox')
                          .list({ includeDeleted: true })
                  ).filter(
                      (record) =>
                          record.payload.entityType === 'SALE' &&
                          (record.syncStatus === 'PENDING' || record.syncStatus === 'RUNNING'),
                  )
                : [];
            const allJobs = database
                ? await database
                      .collection<LocalRecord<TableOutboxPayload>>('sync_outbox')
                      .list({ includeDeleted: true })
                : [];
            const outboxSales = saleJobs.flatMap((record) => {
                if (
                    record.payload.dependencyJobIds?.some(
                        (id) =>
                            !allJobs.some(
                                (job) => job.payload.offlineId === id && job.syncStatus === 'SYNCED',
                            ),
                    )
                )
                    return [];
                const sale = record.payload.data;
                return sale?.id && sale.input ? [sale] : [];
            });
            // Existing installs may still have bills in the old sales queue. New UI
            // checkout writes only through the generic table hook and sync_outbox.
            const pendingSales = saleJobs.length ? outboxSales : cache.queue;
            const scrapJobs = await scrapPurchaseRepository.read(c.key);
            await syncScrapPurchaseJobs(
                scrapJobs,
                (query, variables) => request(c, query, variables, signal),
                () => scrapPurchaseRepository.replace(c.key, scrapJobs),
            );
            const waybillJobs = await waybillRepository.read(c.key);
            if (database)
                await Promise.all(pendingSales.map((sale) => setSaleOutboxStatus(database, sale, 'RUNNING')));
            try {
                await syncPendingSales(
                    pendingSales,
                    (query, variables) => request(c, query, variables, signal),
                    () => (outboxSales.length ? Promise.resolve() : write(c, cache)),
                    async (sale, bill) => {
                        if (database) {
                            const jobs = await database
                                .collection<LocalRecord<TableOutboxPayload>>('sync_outbox')
                                .list({ includeDeleted: true });
                            const job = jobs.find(
                                (candidate) =>
                                    candidate.payload.table === 'sales' &&
                                    candidate.payload.localId === sale.id,
                            );
                            const localSale = await database
                                .collection<LocalRecord<PendingSale>>('sales')
                                .get(sale.id);
                            if (job && localSale) {
                                await resolveTableMutation(
                                    database,
                                    { table: 'sales' },
                                    {
                                        jobId: job.payload.offlineId,
                                        serverId: String(bill.id),
                                        serverVersion: localSale.serverVersion + 1,
                                    },
                                );
                            } else {
                                await database
                                    .collection('sync_outbox')
                                    .remove(saleOutboxId(database, sale.id));
                            }
                        }
                        const job = waybillJobFromSale(sale, bill);
                        if (!job || waybillJobs.some((item) => item.id === job.id)) return;
                        waybillJobs.push(job);
                        await waybillRepository.replace(c.key, waybillJobs);
                    },
                );
            } catch (error) {
                if (database) {
                    const message = error instanceof Error ? error.message : 'Unable to sync bill.';
                    await Promise.all(
                        pendingSales.map((sale) => setSaleOutboxStatus(database, sale, 'PENDING', message)),
                    );
                }
                throw error;
            }
            await syncWaybillJobs(
                waybillJobs,
                (query, variables) => request(c, query, variables, signal),
                () => waybillRepository.replace(c.key, waybillJobs),
            );
        }),
};
