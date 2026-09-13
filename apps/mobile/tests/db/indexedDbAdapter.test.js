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
    await applyBootstrapCollections(database, {
      products: [{ id: 1, name: 'Old' }],
    }, loadedAt);
    await applyBootstrapCollections(database, {
      products: [{ id: 2, name: 'Current' }],
    }, loadedAt);
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
});
