import { requestPos, requestPosBootstrap, requestPosHasUpdates } from '../../core/api/posApi';
import { SerialQueue } from '../../sync/serialQueue';
import { readBillingSnapshot, writeBillingSnapshot } from './data/billingRepository';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { fetchCatalog } from '../products/catalogApi';
import {
    createPendingSale,
    syncPendingSales,
    type CounterSession,
    type PendingSale,
} from '../sales/salesOutbox';
import type { CartItem, CheckoutPayment, Product } from './types/billing';
import type {
    BillingOrderContext,
    BillingPaymentMethod,
    BillingTaxRate,
    Customer,
    ServiceUser,
} from './types/billing';
import { billingReferenceRepository } from './data/billingReferenceRepository';
import type { BillingCalculationPolicy } from './domain/billingTotals';
import { requiresOpenCounter } from '../organization/organizationApi';
import { waybillRepository } from '../logistics/waybillRepository';
import { syncWaybillJobs, waybillJobFromSale } from '../logistics/waybillSync';
import { productBatchRepository } from './data/productBatchRepository';
import { normalizeProductBatches } from './domain/productBatches';
import type { ProductBatch } from './types/billing';
import { scrapPurchaseRepository } from '../scrap/scrapPurchaseRepository';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '../scrap/scrapSync';
import { canManageScrap } from '../scrap/permissions';
import {
    applyPosBootstrap,
    bootstrapCollectionMap,
    getActiveDatabase,
    normalizeBootstrapCollections,
    type LocalDatabase,
} from '@indyzai/pos-database';

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
const billingBootstrapCollections = [
    'products',
    'customers',
    'serviceUsers',
    'paymentMethods',
    'taxRates',
    'counterSessions',
];
async function updatedBootstrapCollections(c: Context, database: LocalDatabase, signal?: AbortSignal) {
    const states = await database.collection('sync_state').list({ includeDeleted: true });
    const loadedMap = new Map(
        states.map((state) => [
            String((state.payload as { collection?: string }).collection ?? state.remoteId),
            Number((state.payload as { lastSyncedAt?: number }).lastSyncedAt),
        ]),
    );
    const missing = billingBootstrapCollections.filter(
        (col) => !loadedMap.has(col) && !loadedMap.has(bootstrapCollectionMap[col] ?? col),
    );
    const loaded = Array.from(loadedMap.values()).filter(Number.isFinite);
    if (!loaded.length) return billingBootstrapCollections;

    const result = await requestPosHasUpdates<{ updates: Record<string, boolean> }>(c.token, c.tenant, {
        since: new Date(Math.max(...loaded)).toISOString(),
        route: '/',
        collections: billingBootstrapCollections,
        signal,
    });
    return billingBootstrapCollections.filter(
        (collection) => result.updates[collection] || missing.includes(collection),
    );
}
async function context(): Promise<Context> {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Your workspace is still initializing. Please try again.');
    return {
        key: appStorageKeys.admin.billing(session.user.id, session.tenant.id),
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
    if ((await context()).key !== c.key) throw new Error('Business changed. Please retry.');
    return requestPos<T>(c.token, c.tenant, query, variables, signal);
}

export const billingApi = {
    load: () =>
        syncQueue.run(async () => {
            const c = await context();
            return { key: c.key, cache: await read(c) };
        }),
    loadScrapProducts: async (signal?: AbortSignal) => {
        const c = await context();
        return fetchCatalog((query, variables) => request(c, query, variables, signal), 'SCRAP');
    },
    refresh: (signal?: AbortSignal, database?: LocalDatabase | null, forceBootstrap = false) =>
        syncQueue.run(async () => {
            const c = await context();
            const cache = await read(c);
            const targetDb = database ?? getActiveDatabase();
            const collections =
                targetDb && !forceBootstrap
                    ? await updatedBootstrapCollections(c, targetDb, signal)
                    : billingBootstrapCollections;
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
    ) =>
        syncQueue.run(async () => {
            const c = await context();
            if (c.key !== key) throw new Error('Business changed. Start a new cart.');
            const cache = await read(c);
            const auth = getActiveAuthSession();
            const requireOpenSession = requiresOpenCounter(auth?.organization?.settings);
            const currentSession = auth?.organization ? auth.organization.activeSession : cache.session;
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
            cache.queue.push(sale);
            try {
                await write(c, cache); // Never clear the cart until this durable write succeeds.
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
            const data = await request<{ saveParty: Record<string, unknown> }>(
                c,
                `mutation CreateBillingCustomer($input: NewPartyInput!) { saveParty(input: $input) { id name phone email addressLine gstin creditLimit balance } }`,
                { input: { ...input, type: 'CUSTOMER' } },
            );
            const party = data.saveParty;
            const customer: Customer = {
                id: String(party.id),
                name: String(party.name),
                type: 'CUSTOMER',
                phone: String(party.phone || '') || undefined,
                email: String(party.email || '') || undefined,
                gstin: String(party.gstin || '') || undefined,
                address: String(party.addressLine || '') || undefined,
                creditLimit: party.creditLimit == null ? undefined : Number(party.creditLimit),
                balance: party.balance == null ? undefined : Number(party.balance),
            };
            const current = await billingReferenceRepository.readCustomers(c.key);
            await billingReferenceRepository.replaceCustomers(c.key, [customer, ...current]);
            return customer;
        }),
    sync: (signal?: AbortSignal) =>
        syncQueue.run(async () => {
            const c = await context();
            const cache = await read(c);
            const scrapJobs = await scrapPurchaseRepository.read(c.key);
            await syncScrapPurchaseJobs(
                scrapJobs,
                (query, variables) => request(c, query, variables, signal),
                () => scrapPurchaseRepository.replace(c.key, scrapJobs),
            );
            const waybillJobs = await waybillRepository.read(c.key);
            await syncPendingSales(
                cache.queue,
                (query, variables) => request(c, query, variables, signal),
                () => write(c, cache),
                async (sale, bill) => {
                    const job = waybillJobFromSale(sale, bill);
                    if (!job || waybillJobs.some((item) => item.id === job.id)) return;
                    waybillJobs.push(job);
                    await waybillRepository.replace(c.key, waybillJobs);
                },
            );
            await syncWaybillJobs(
                waybillJobs,
                (query, variables) => request(c, query, variables, signal),
                () => waybillRepository.replace(c.key, waybillJobs),
            );
        }),
};
