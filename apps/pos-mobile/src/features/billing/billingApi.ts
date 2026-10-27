import type { LocalDatabase } from '@indyzai/pos-database';
import { refreshNativeData } from '@indyzai/pos-sync-native';
import { commitCheckout } from '@indyzai/feature-billing/checkout';
import { syncDatabase } from '@indyzai/pos-database/sync-runtime';
import { resolveQueuedReferences } from '@indyzai/pos-sync-native';
import { requestPos, syncApiMutations } from '../../core/api/posApi';
import { SerialQueue } from '@indyzai/pos-sync';
import { readBillingSnapshot, writeBillingSnapshot } from '@indyzai/feature-billing/data/billingRepository';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
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
import { requiresOpenCounter } from '@indyzai/feature-organization/organizationSettings';
import { waybillRepository } from '@indyzai/feature-orders/logistics/waybillRepository';
import { syncWaybillJobs, waybillJobFromSale } from '@indyzai/feature-orders/logistics/waybillSync';
import { productBatchRepository } from '@indyzai/feature-billing/data/productBatchRepository';

import type { ProductBatch } from '@indyzai/feature-billing/types/billing';
import { scrapPurchaseRepository } from '@indyzai/feature-scrap/scrapPurchaseRepository';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '@indyzai/feature-scrap/scrapSync';
import { canAcceptScrapExchange } from '@indyzai/feature-scrap/permissions';
import { getActiveDatabase, createScopeKey, type LocalRecord } from '@indyzai/pos-database';
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
  errorMessage?: string;
  attempts?: number;
};
const saleOutboxId = (database: LocalDatabase, offlineId: string) =>
  `${createScopeKey(database.scope)}:outbox:sale:${offlineId}`;
async function setSaleOutboxStatus(
  database: LocalDatabase,
  sale: PendingSale,
  syncStatus: 'PENDING' | 'RUNNING' | 'FAILED',
  errorMessage?: string,
  attempts?: number,
) {
  const now = Date.now();
  const existing = (
    await database.collection<LocalRecord<SaleOutboxPayload>>('sync_outbox').list({ includeDeleted: true })
  ).find(
    (record) =>
      (record.payload.table === 'sales' && record.payload.localId === sale.id) ||
      record.payload.offlineId === sale.id,
  );
  const resolvedAttempts = attempts ?? sale.attempts ?? existing?.payload.attempts ?? 0;
  if (existing) {
    await database.collection<LocalRecord<SaleOutboxPayload>>('sync_outbox').put({
      ...existing,
      payload: {
        ...existing.payload,
        ...(errorMessage ? { errorMessage } : {}),
        attempts: resolvedAttempts,
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
    attempts: resolvedAttempts,
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
    signal?.throwIfAborted();
    const cache = await readBillingSnapshot(c.key);
    signal?.throwIfAborted();
    return cache.products.filter((product) => product.categoryType === 'SCRAP');
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
            throw new Error('The customer is not ready to synchronize. Retry saving the customer.');
        }
      }
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
      sale.createdByUserId = auth?.user.id;
      if (!database) throw new Error('Your local workspace is still initializing.');
      if (payment.scrap && !canAcceptScrapExchange(auth?.tenant.role))
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
      const c = await context();
      const database = getActiveDatabase();
      if (database) {
        await customersApi.pushPending(signal, database);
        await purchasesApi.pushPending(signal);
      }
      await syncApiMutations(signal);
      const cache = await read(c);
      const saleJobs = database
        ? (
            await database
              .collection<LocalRecord<SaleOutboxPayload>>('sync_outbox')
              .list({ includeDeleted: true })
          ).filter(
            (record) =>
              record.payload.entityType === 'SALE' &&
              (record.syncStatus === 'PENDING' || record.syncStatus === 'RUNNING') &&
              (record.payload.attempts ?? 0) < 3,
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
            (id) => !allJobs.some((job) => job.payload.offlineId === id && job.syncStatus === 'SYNCED'),
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
                (candidate) => candidate.payload.table === 'sales' && candidate.payload.localId === sale.id,
              );
              const localSale = await database.collection<LocalRecord<PendingSale>>('sales').get(sale.id);
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
                await database.collection('sync_outbox').remove(saleOutboxId(database, sale.id));
              }
            }
            const job = waybillJobFromSale(sale, bill);
            if (!job || waybillJobs.some((item) => item.id === job.id)) return;
            waybillJobs.push(job);
            await waybillRepository.replace(c.key, waybillJobs);
          },
          database ? (input) => resolveQueuedReferences(database, input) : undefined,
        );
      } catch (error) {
        if (database) {
          const message = error instanceof Error ? error.message : 'Unable to sync bill.';
          await Promise.all(
            pendingSales.map((sale) => {
              const attempts = sale.attempts ?? 1;
              const isFailed = attempts >= 3;
              return setSaleOutboxStatus(database, sale, isFailed ? 'FAILED' : 'PENDING', message, attempts);
            }),
          );
        }
        throw error;
      }
      await syncWaybillJobs(
        waybillJobs,
        (query, variables) => request(c, query, variables, signal),
        () => waybillRepository.replace(c.key, waybillJobs),
      );
    });
  },
};
