import type { LocalDatabase } from '@indyzai/pos-database';
import { refreshNativeData } from '@indyzai/pos-sync-native';
import { commitCheckout } from '@indyzai/feature-billing/checkout';
import { syncDatabase } from '@indyzai/pos-database/sync-runtime';
import { resolveQueuedReferences } from '@indyzai/pos-sync-native';
import { requestPos, syncApiMutations } from '../../core/api/posApi';
import { purchasesApi } from '../purchases/purchasesApi';
import { customersApi } from '../customers/customersApi';
import { SerialQueue } from '@indyzai/pos-sync-native';
import {
  resolveTableMutation,
  type TableOutboxPayload,
  type MutationDependency,
} from '@indyzai/pos-database/table-mutations';
import { readBillingSnapshot, writeBillingSnapshot } from '@indyzai/feature-billing/data/billingRepository';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { fetchCatalog } from '@indyzai/feature-catalog/catalogApi';
import { settingsApi } from '../settings/settingsApi';
import { printerConfigurationApi } from '../printing/printerConfigurationApi';
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
import { requiresOpenCounter } from '../organization/organizationApi';
import { waybillRepository } from '@indyzai/feature-orders/logistics/waybillRepository';
import { syncWaybillJobs, waybillJobFromSale } from '@indyzai/feature-orders/logistics/waybillSync';
import { productBatchRepository } from '@indyzai/feature-billing/data/productBatchRepository';

import type { ProductBatch } from '@indyzai/feature-billing/types/billing';
import { scrapPurchaseRepository } from '@indyzai/feature-scrap/scrapPurchaseRepository';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '@indyzai/feature-scrap/scrapSync';
import { canManageScrap } from '@indyzai/feature-scrap/permissions';
import { getActiveDatabase, type LocalRecord } from '@indyzai/pos-database';

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
export const fallbackPaymentMethods: BillingPaymentMethod[] = [
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
const pushQueue = new SerialQueue();
const billingBootstrapCollections = [
  'products',
  'categories',
  'units',
  'serviceUsers',
  'paymentMethods',
  'taxRates',
  'counterSessions',
];
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
  const database = getActiveDatabase();
  const resolved = database ? await resolveQueuedReferences(database, variables) : variables;
  if (query.includes('MobileRecordScrap')) {
    const input = resolved.input as Record<string, unknown>;
    for (const field of ['partyId', 'branchId', 'counterId', 'counterSessionId']) {
      if (input[field] == null) continue;
      const id = Number(input[field]);
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error('The scrap exchange is waiting for its dependencies to synchronize.');
      input[field] = id;
    }
  }
  const result = await requestPos<T>(c.token, c.tenant, query, resolved, signal);
  if (getActiveDatabase() !== database || (await context()).key !== c.key)
    throw new Error('Business changed. Please retry.');
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
  refresh: async (
    signal?: AbortSignal,
    database?: LocalDatabase | null,
    _forceBootstrap = false,
    _requestedCollections?: string[],
  ) => {
    const target = database ?? getActiveDatabase();
    if (!target) throw new Error('Local workspace is not ready.');
    await refreshNativeData(target, signal);
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
      const localDatabase = getActiveDatabase();
      const shifts = localDatabase
        ? await localDatabase.collection<LocalRecord<CounterSession>>('shifts').list()
        : [];
      const currentSession = shifts.length
        ? (shifts.find((row) => row.payload.status.toUpperCase() === 'OPEN')?.payload ?? null)
        : auth?.organization
          ? auth.organization.activeSession
          : cache.session;
      const database = localDatabase;
      const dependencies: MutationDependency[] = [];
      const pendingReferences = database
        ? await database
            .collection<LocalRecord<TableOutboxPayload>>('sync_outbox')
            .list({ includeDeleted: true })
        : [];
      const referenceIds = new Set([currentSession?.id, ...items.map((item) => item.id)]);
      for (const job of pendingReferences) {
        if (job.syncStatus !== 'SYNCED' && referenceIds.has(job.payload.localId))
          dependencies.push({ jobId: job.payload.offlineId });
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
      if (!database) throw new Error('Your local workspace is still initializing.');
      if (payment.scrap && !canManageScrap(auth?.tenant.role))
        throw new Error('Your role cannot accept scrap exchanges.');
      if (payment.scrap && !currentSession) throw new Error('Open a counter session before accepting scrap.');
      const queued = await commitCheckout(
        database,
        sale,
        dependencies,
        payment.scrap ? scrapPurchaseJob(payment.scrap, currentSession!, customer) : undefined,
      );
      return {
        record: { id: sale.id, receiptNumber: sale.receiptNumber },
        jobId: queued.jobId,
        syncStatus: 'pending' as const,
      };
    }),
  createCustomer: (key: string, input: { name: string; phone?: string; email?: string; gstin?: string }) =>
    syncQueue.run(async () => {
      const c = await context();
      if (c.key !== key) throw new Error('Business changed. Please retry.');
      return customersApi.create(input);
    }),
  sync: (signal?: AbortSignal) => {
    const database = getActiveDatabase();
    if (database?.canonicalJobs) return syncDatabase(database, signal);
    return pushQueue.run(async () => {
      // A settings failure must not prevent financial outbox jobs from progressing.
      await settingsApi.pushPending(signal).catch(() => undefined);
      await printerConfigurationApi.pushPending(signal).catch(() => undefined);
      const activeDatabase = getActiveDatabase();
      if (activeDatabase) {
        await customersApi.pushPending(signal, activeDatabase);
        await purchasesApi.pushPending(signal);
      }
      const c = await context();
      await syncApiMutations(signal);
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
          if (activeDatabase) {
            const jobs = await activeDatabase
              .collection<LocalRecord<TableOutboxPayload>>('sync_outbox')
              .list({ includeDeleted: true });
            const command = jobs.find(
              (job) => job.payload.table === 'sales' && job.payload.localId === sale.id,
            );
            if (command)
              await resolveTableMutation(
                activeDatabase,
                { table: 'sales' },
                { jobId: command.payload.offlineId, serverId: String(bill.id) },
              );
          }
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
    });
  },
};
