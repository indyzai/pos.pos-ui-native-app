import 'fake-indexeddb/auto';
import { afterEach, describe, expect, test } from 'bun:test';
import { createScopeKey } from '@indyzai/pos-database';

const scope = {
  tenantId: 'tenant-web',
  userId: 'cashier-web',
  role: 'cashier',
  storeIds: ['store-web'],
  deviceId: 'browser',
  counterId: 'counter-web',
};

afterEach(async () => {
  const { default: Dexie } = await import('dexie');
  await Dexie.delete('indyz-pos-local-v1');
});

describe('IndexedDB local database adapter', () => {
  test('persists and observes scoped records through the shared repository contract', async () => {
    const { IndexedDbLocalDatabase } = await import('@indyzai/pos-database/indexeddb');
    const database = new IndexedDbLocalDatabase(scope);
    await database.initialize();
    const products = database.collection('products');
    const scopeKey = createScopeKey(scope);
    let changes = 0;
    const unsubscribe = products.subscribe(() => changes++);
    await products.put({
      id: `${scopeKey}:product:1`,
      scope: scopeKey,
      tenantId: scope.tenantId,
      storeId: scope.storeIds[0],
      remoteId: '1',
      payload: { name: 'Coffee' },
      serverVersion: 1,
      syncStatus: 'SYNCED',
      updatedAt: 1,
    });
    expect((await products.list()).map((record) => record.payload.name)).toEqual(['Coffee']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(changes).toBeGreaterThan(0);
    unsubscribe();
    await database.close();
  });

  test('rejects collections not provisioned for the role', async () => {
    const { IndexedDbLocalDatabase } = await import('@indyzai/pos-database/indexeddb');
    const database = new IndexedDbLocalDatabase(scope);
    await database.initialize();
    expect(() => database.collection('purchase_orders')).toThrow();
    await database.close();
  });

  test('clears all active database collections without closing the adapter', async () => {
    const { IndexedDbLocalDatabase } = await import('@indyzai/pos-database/indexeddb');
    const database = new IndexedDbLocalDatabase(scope);
    await database.initialize();
    const scopeKey = createScopeKey(scope);
    await database.collection('customers').put({
      id: `${scopeKey}:customers:1`,
      scope: scopeKey,
      tenantId: scope.tenantId,
      storeId: scope.storeIds[0],
      remoteId: '1',
      payload: { id: '1', name: 'Customer' },
      serverVersion: 1,
      syncStatus: 'SYNCED',
      updatedAt: 1,
    });
    await database.clear();
    expect(await database.collection('customers').list()).toEqual([]);
    await database.collection('customers').put({
      id: `${scopeKey}:customers:2`,
      scope: scopeKey,
      tenantId: scope.tenantId,
      storeId: scope.storeIds[0],
      remoteId: '2',
      payload: { id: '2', name: 'After clear' },
      serverVersion: 1,
      syncStatus: 'SYNCED',
      updatedAt: 2,
    });
    expect(await database.collection('customers').list()).toHaveLength(1);
    await database.close();
  });

  test('atomically replaces bootstrap data with API records and records collection load time', async () => {
    const { IndexedDbLocalDatabase } = await import('@indyzai/pos-database/indexeddb');
    const { applyBootstrapCollections } = await import('@indyzai/pos-database');
    const database = new IndexedDbLocalDatabase(scope);
    await database.initialize();
    const loadedAt = '2026-09-13T10:30:00.000Z';
    await applyBootstrapCollections(
      database,
      {
        products: [{ id: 1, name: 'Old' }],
      },
      loadedAt,
    );
    await applyBootstrapCollections(
      database,
      {
        products: [{ id: 2, name: 'Current' }],
      },
      loadedAt,
    );
    const products = await database.collection('products').list();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ remoteId: '2', syncStatus: 'API' });
    const states = await database.collection('sync_state').list();
    expect(states[0].payload).toEqual({
      collection: 'products',
      lastSyncedAt: Date.parse(loadedAt),
    });
    await database.close();
  });

  test('applyPosBootstrap normalizes raw collections, writes to local DB, and tracks product_batches sync_state', async () => {
    const { IndexedDbLocalDatabase } = await import('@indyzai/pos-database/indexeddb');
    const { applyPosBootstrap } = await import('@indyzai/pos-database');
    const database = new IndexedDbLocalDatabase(scope);
    await database.initialize();
    const loadedAt = '2026-09-13T12:00:00.000Z';
    const rawCollections = {
      products: [
        {
          id: 'prod-1',
          name: 'Paracetamol 500mg',
          price: 25,
          stock: 100,
          category: 'Pharmacy',
          categoryType: 'INVENTORY',
          details: {
            batchNumber: 'BATCH-2026A',
            expiryDate: '2027-01-01',
          },
        },
      ],
      customers: [
        {
          id: 'cust-1',
          name: 'Alice',
          type: 'CUSTOMER',
          phone: '9876543210',
        },
      ],
      paymentMethods: [
        {
          id: 'pm-1',
          name: 'UPI',
          code: 'UPI',
          isActive: true,
          isQuickAccess: true,
        },
      ],
      taxRates: [
        {
          id: 'tax-1',
          name: 'GST 5%',
          rate: 5,
          isActive: true,
        },
      ],
      serviceUsers: [
        {
          id: 'tech-1',
          name: 'Bob',
          phone: '1234567890',
        },
      ],
    };

    const normalized = await applyPosBootstrap(database, rawCollections, loadedAt);
    expect(normalized.products).toHaveLength(1);
    expect(normalized.customers).toHaveLength(1);
    expect(normalized.paymentMethods).toHaveLength(1);
    expect(normalized.taxRates).toHaveLength(1);
    expect(normalized.serviceUsers).toHaveLength(1);
    expect(normalized.productBatches).toHaveLength(1);

    const localProducts = await database.collection('products').list();
    expect(localProducts).toHaveLength(1);
    expect(localProducts[0].payload.name).toBe('Paracetamol 500mg');

    const localBatches = await database.collection('product_batches').list();
    expect(localBatches).toHaveLength(1);
    expect(localBatches[0].payload.batchNumber).toBe('BATCH-2026A');

    const localCustomers = await database.collection('customers').list();
    expect(localCustomers).toHaveLength(1);
    expect(localCustomers[0].payload.name).toBe('Alice');

    const states = await database.collection('sync_state').list();
    const syncedCollections = states.map((s) => s.payload.collection);
    expect(syncedCollections).toContain('products');
    expect(syncedCollections).toContain('customers');
    expect(syncedCollections).toContain('product_batches');

    await database.close();
  });
});
