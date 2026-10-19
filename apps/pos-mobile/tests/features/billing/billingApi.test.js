import { createRefreshCoordinator } from '@indyzai/pos-sync';
import { applyRefreshBatch, readRefreshMarkers } from '@indyzai/pos-database';
import { registerNativeRefresh } from '../../../../../vendor/pos-ui-shared/packages-native/sync-native/src/nativeRefresh';
import { beforeEach, afterEach, expect, mock, test } from 'bun:test';
import { setActiveDatabase, getActiveDatabase, createScopeKey } from '@indyzai/pos-database';
import { requiresOpenCounter } from '@indyzai/feature-organization/organizationSettings';
mock.module('../../../src/features/organization/organizationApi', () => ({
  requiresOpenCounter,
}));
const storage = new Map();
let tenant = '1';
let failWrite = false;
const customers = new Map();
const paymentMethods = new Map();
const serviceUsers = new Map();
const waybillJobs = new Map();
const productBatches = new Map();
const scrapPurchaseJobs = new Map();
const taxRates = new Map();
const clone = (value) => structuredClone(value);
const localReferences = async (table, fallback) => {
  const database = getActiveDatabase();
  const rows = database ? await database.collection(table).list() : [];
  return rows.length ? rows.map((row) => row.payload) : clone(fallback ?? []);
};
mock.module('@indyzai/feature-billing/data/billingRepository', () => ({
  readBillingSnapshot: async (key) => {
    const snapshot = clone(storage.get(key) ?? { products: [], session: null, queue: [] });
    const database = getActiveDatabase();
    const rows = database ? await database.collection('sales').list() : [];
    snapshot.queue = rows.filter((row) => row.syncStatus !== 'SYNCED').map((row) => row.payload);
    snapshot.products = await localReferences('products', snapshot.products);
    return snapshot;
  },
  writeBillingSnapshot: async (key, value) => {
    if (failWrite) throw new Error('Disk full');
    storage.set(key, clone(value));
  },
}));
mock.module('@indyzai/feature-billing/data/billingReferenceRepository', () => ({
  billingReferenceRepository: {
    readCustomers: async (key) => localReferences('customers', customers.get(key)),
    replaceCustomers: async (key, value) => customers.set(key, clone(value)),
    readPaymentMethods: async (key) => localReferences('payment_methods', paymentMethods.get(key)),
    replacePaymentMethods: async (key, value) => paymentMethods.set(key, clone(value)),
    readServiceUsers: async (key) => localReferences('service_users', serviceUsers.get(key)),
    replaceServiceUsers: async (key, value) => serviceUsers.set(key, clone(value)),
    readTaxRates: async (key) => localReferences('tax_rates', taxRates.get(key)),
    replaceTaxRates: async (key, value) => taxRates.set(key, clone(value)),
  },
}));
mock.module('@indyzai/feature-orders/logistics/waybillRepository', () => ({
  waybillRepository: {
    read: async (key) => clone(waybillJobs.get(key) ?? []),
    replace: async (key, value) => waybillJobs.set(key, clone(value)),
  },
}));
mock.module('@indyzai/feature-billing/data/productBatchRepository', () => ({
  productBatchRepository: {
    read: async (key) => localReferences('product_batches', productBatches.get(key)),
    replace: async (key, value) => productBatches.set(key, clone(value)),
  },
}));
mock.module('@indyzai/feature-scrap/scrapPurchaseRepository', () => ({
  scrapPurchaseRepository: {
    read: async (key) => clone(scrapPurchaseJobs.get(key) ?? []),
    replace: async (key, value) => scrapPurchaseJobs.set(key, clone(value)),
  },
}));
mock.module('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

mock.module('@indyzai/pos-auth/session', () => ({
  getActiveAuthSession: () => ({
    user: { id: 'user' },
    tenant: { id: tenant, role: 'owner' },
    token: 'test-token',
    organization: { activeSession: { id: '2', counterId: '3', status: 'OPEN' } },
  }),
}));
const { billingApi } = await import('../../../src/features/billing/billingApi');
const key = 'indyz.billing.v1:user:1';
const items = [{ id: '42', price: 10, quantity: 2, taxRate: 5 }];
function testDatabase() {
  const tables = new Map();
  const scope = { tenantId: '1', userId: 'user', role: 'owner', storeIds: ['branch'], deviceId: 'device' };
  const database = {
    scope,
    collection(name) {
      const rows = tables.get(name) ?? new Map();
      tables.set(name, rows);
      return {
        list: async () => clone([...rows.values()]),
        get: async (id) => (rows.has(id) ? clone(rows.get(id)) : undefined),
        put: async (record) => {
          if (failWrite) throw new Error('Disk full');
          return rows.set(record.id, clone(record));
        },
        putMany: async (records) => {
          for (const record of records) rows.set(record.id, clone(record));
        },
        remove: async (id) => rows.delete(id),
        replace: async (records) => {
          rows.clear();
          for (const record of records) rows.set(record.id, clone(record));
        },
        subscribe: () => () => {},
      };
    },
    transaction: async (_collections, work) => {
      const before = clone(tables);
      try {
        return await work(database);
      } catch (error) {
        tables.clear();
        for (const [name, rows] of before) tables.set(name, rows);
        throw error;
      }
    },
  };
  return database;
}
afterEach(() => setActiveDatabase(null));
beforeEach(() => {
  setActiveDatabase(testDatabase());
  storage.clear();
  customers.clear();
  paymentMethods.clear();
  serviceUsers.clear();
  waybillJobs.clear();
  productBatches.clear();
  scrapPurchaseJobs.clear();
  taxRates.clear();
  tenant = '1';
  failWrite = false;
  process.env.EXPO_PUBLIC_POS_API_URL = 'https://example.test/graphql';
  storage.set(key, { products: [], session: { id: '2', counterId: '3', status: 'OPEN' }, queue: [] });
});
test('concurrent sales are retained', async () => {
  await Promise.all([billingApi.checkout(key, items, 'Cash'), billingApi.checkout(key, items, 'Cash')]);
  const { cache } = await billingApi.load();
  expect(cache.queue).toHaveLength(2);
  expect(cache.queue[0].input.totalAmount).toBe(21);
  expect(cache.queue[0].id).not.toBe(cache.queue[1].id);
});
test('billing returns the durable common-worker job instead of a screen-owned persistence callback', async () => {
  const result = await billingApi.checkout(key, items, 'Cash');
  expect(typeof result.record.id).toBe('string');
  expect(typeof result.record.receiptNumber).toBe('string');
  expect(typeof result.jobId).toBe('string');
  expect(result.syncStatus).toBe('pending');
  const job = await getActiveDatabase().collection('sync_outbox').get(result.jobId);
  expect(job.payload.entityType).toBe('SALE');
  expect(job.payload.data.input).toMatchObject({ offlineId: result.record.id, totalAmount: 21 });
  expect((await billingApi.load()).cache.queue).toHaveLength(1);
});
test('customized restaurant lines retain the original product and line metadata', async () => {
  await billingApi.checkout(
    key,
    [
      {
        ...items[0],
        lineId: '42:large,no-onion',
        customization: {
          key: 'large,no-onion',
          label: 'Large, No onion',
          priceAdjustment: 30,
          notes: 'Serve hot',
        },
      },
    ],
    'Cash',
    undefined,
    0,
    undefined,
    { orderMode: 'DINE_IN', tableId: '7', tableName: 'T7' },
  );
  const input = (await billingApi.load()).cache.queue[0].input;
  expect(input.items[0].productId).toBe(42);
  expect(input.details.itemCustomizations[0]).toMatchObject({ productId: '42', notes: 'Serve hot' });
  expect(input.details).toMatchObject({ orderMode: 'DINE_IN', tableId: '7' });
});

test('pharmacy prescription context is retained in the queued sale', async () => {
  await billingApi.checkout(
    key,
    [{ ...items[0], details: { prescriptionRequired: true }, quantity: 1 }],
    'CASH',
    undefined,
    0,
    undefined,
    { doctorName: 'Dr Rao', prescriptionReference: 'RX-42' },
  );
  const input = (await billingApi.load()).cache.queue[0].input;
  expect(input.details).toMatchObject({
    doctorName: 'Dr Rao',
    prescriptionReference: 'RX-42',
  });
});
test('wholesale sale retains a draft waybill until the bill has a server invoice', async () => {
  await billingApi.checkout(
    key,
    items,
    'CASH',
    undefined,
    0,
    { id: '7', name: 'Buyer', address: 'Buyer address', gstin: 'GST-7' },
    { autoCreateWaybill: true, waybillSeller: { name: 'Seller', address: 'Seller address' } },
  );
  const details = (await billingApi.load()).cache.queue[0].input.details;
  expect(details.waybillDraft).toMatchObject({
    sellerName: 'Seller',
    buyerName: 'Buyer',
    destinationAddress: 'Buyer address',
  });
  expect(details.waybillDraft.invoiceNumber).toBeUndefined();
});
test('scrap exchange is durably queued and linked to the sale payment', async () => {
  await billingApi.checkout(key, items, {
    method: 'CASH',
    scrap: {
      id: 'SCRAP-offline-7',
      total: 5,
      items: [{ productId: '7', productName: 'Old battery', quantity: 1, unitPrice: 5 }],
    },
  });
  expect(
    (await getActiveDatabase().collection('scrap_purchase_jobs').list()).map((row) => row.payload),
  ).toEqual([expect.objectContaining({ id: 'SCRAP-offline-7', status: 'PENDING' })]);
  const input = (await billingApi.load()).cache.queue[0].input;
  expect(input.payments).toEqual([
    { paymentMethod: 'SCRAP', amountPaid: 5, referenceNumber: 'SCRAP-offline-7' },
    { paymentMethod: 'CASH', amountPaid: 16 },
  ]);
});
test('failed upload retains sale and reuses offlineId', async () => {
  const {
    record: { id, receiptNumber },
    jobId,
    syncStatus,
  } = await billingApi.checkout(key, items, 'Cash');
  expect(jobId).toBeTruthy();
  expect(syncStatus).toBe('pending');
  expect(receiptNumber).toMatch(/^POS-\d{8}-3-[A-Z0-9]{6}$/);
  globalThis.fetch = async () => {
    throw new Error('Offline');
  };
  await expect(billingApi.sync()).rejects.toThrow('Offline');
  expect((await billingApi.load()).cache.queue[0].id).toBe(id);
  let clientId;
  globalThis.fetch = async (url, options) => {
    if (options.body) {
      const batch = JSON.parse(options.body);
      expect(batch.jobs).toHaveLength(1);
      expect(batch.jobs[0].input.newBillData.offlineId).toBe(id);
      clientId = batch.jobs[0].id;
      return { ok: true, json: async () => ({ jobs: [{ id: '501', clientId, status: 'pending' }] }) };
    }
    expect(String(url)).toContain('/sync/jobs?ids=501');
    expect((await billingApi.load()).cache.queue[0].id).toBe(id);
    return { ok: true, json: async () => ({ jobs: [{ id: '501', clientId, status: 'completed', result: { data: { saveBill: { id: '99' } } } }] }) };
  };
  await billingApi.sync();
  expect((await billingApi.load()).cache.queue).toHaveLength(0);
});
test('storage failure and business switch reject checkout', async () => {
  failWrite = true;
  await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Disk full');
  failWrite = false;
  tenant = 'other';
  await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Business changed');
  expect((await billingApi.load()).cache.queue).toHaveLength(0);
});

test('catalog refresh maps and persists products for offline billing', async () => {
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => ({
      generatedAt: '2026-01-01T00:00:00.000Z',
      collections: {
        products: [
          {
            id: 42,
            name: 'Offline tea',
            sku: 'TEA-42',
            image: 'https://example.test/tea.png',
            details: { isQuickItem: true, serviceDurationMinutes: 45 },
            price: 20,
            stock: 7,
            barcode: '8901000000042',
            category: 'Beverages',
            categoryType: 'INVENTORY',
            taxRate: 5,
          },
        ],
        customers: [{ id: 7, name: 'Customer A', type: 'customer' }],
        serviceUsers: [{ id: 8, name: 'Technician A', phone: '123', specialization: 'Repair' }],
        paymentMethods: [],
        taxRates: [{ id: 5, name: 'GST 5%', rate: 5, isActive: true }],
        counterSessions: [],
      },
    }),
  });
  const initial = await (await globalThis.fetch('initial-fixture')).json();
  const database = getActiveDatabase();
  const nodes = Object.keys(initial.collections).map((resourceKey) => ({
    key: `pos.test.${resourceKey}`,
    parentKey: 'pos.test',
    type: 'collection',
    resourceKey,
    partitionKey: '-',
    requiredRevision: '1',
    availableRevision: '1',
    updatedAt: initial.generatedAt,
    invalidatedAt: initial.generatedAt,
    dependsOn: [],
  }));
  const coordinator = createRefreshCoordinator({
    resources: () => new Set(Object.keys(initial.collections)),
    adapter: {
      readMarkers: () => readRefreshMarkers(database),
      fetchTree: async () => ({
        version: 1,
        orgRefId: '1',
        revision: '1',
        updatedAt: initial.generatedAt,
        nodes,
      }),
      fetchPage: async (node) => ({
        revision: '1',
        updatedAt: initial.generatedAt,
        mode: 'snapshot',
        rows: initial.collections[node.resourceKey],
        deletedIds: [],
        nextCursor: null,
      }),
      apply: (batch, signal) => applyRefreshBatch(database, batch, signal),
    },
  });
  const unregister = registerNativeRefresh(database, coordinator);
  try {
    await billingApi.refresh();
  } finally {
    unregister();
  }
  const { cache } = await billingApi.load();
  expect(cache.products).toEqual([
    expect.objectContaining({
      id: '42',
      name: 'Offline tea',
      sku: 'TEA-42',
      imageUrl: 'https://example.test/tea.png',
      quick: true,
      category: 'Beverages',
      categoryType: 'INVENTORY',
      details: expect.objectContaining({ serviceDurationMinutes: 45 }),
      stock: 7,
      taxRate: 5,
    }),
  ]);
  expect(cache.serviceUsers).toEqual([
    expect.objectContaining({ id: '8', name: 'Technician A', specialization: 'Repair' }),
  ]);
  expect(cache.customers).toEqual([
    expect.objectContaining({ id: '7', name: 'Customer A', type: 'CUSTOMER' }),
  ]);
  expect(cache.productBatches).toEqual([]);
  expect(cache.taxRates).toEqual([{ id: '5', name: 'GST 5%', percentage: 5, isActive: true }]);
});
