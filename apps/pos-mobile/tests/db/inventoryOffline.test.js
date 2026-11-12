import 'fake-indexeddb/auto';
import { expect, mock, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { applyBootstrapCollections } from '@indyzai/pos-database';
mock.module('@indyzai/pos-auth/session', () => ({ getActiveAuthSession: () => null }));
const { createInventoryApi } = await import('@indyzai/feature-inventory/inventoryApi');
import { pushApiMutations } from '@indyzai/pos-sync-native';

test('inventory writes return pending jobs with usable local metadata and sync the latest edit later', async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `inventory-offline-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'manager', storeIds: ['b'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  let requests = 0;
  const api = createInventoryApi({
    getSession: () => ({ token: 'token', tenant: { id: 't' }, user: { id: 'u' } }),
    getDatabase: () => database,
    scopeKey: () => 'scope',
    request: async () => {
      requests++;
      throw new Error('Network is offline');
    },
    billing: {
      load: async () => ({ key: 'scope', cache: {} }),
      refresh: async () => {
        requests++;
      },
    },
  });
  try {
    await applyBootstrapCollections(database, {
      categories: [{ id: '1', name: 'Beverages' }],
      taxRates: [{ id: '2', name: 'GST', percentage: 5 }],
    });
    const input = { name: 'Tea', price: 10, stock: 8, categoryId: 1, taxId: 2, iconKey: 'package' };
    const created = (await api.create(input)).record;
    expect(created.status).toBe('PENDING');
    const [record] = await database.collection('products').list();
    expect(record.payload).toMatchObject({ name: 'Tea', stock: 8, taxRate: 5, category: 'Beverages' });
    await api.update({ ...input, name: 'Updated tea', productId: record.payload.id });
    await api.reconcileReport({ items: [{ productId: record.payload.id, countedQuantity: 4 }] });
    expect(requests).toBe(0);
    expect((await database.collection('products').get(record.id)).payload.stock).toBe(4);
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async (query, variables) => {
        if (query.includes('CreateProduct')) return { newProduct: { product: { id: '42' } } };
        if (query.includes('UpdateProduct')) {
          expect(variables.id).toBe('42');
          return { updateProduct: { success: true, product: { id: '42' } } };
        }
        expect(variables.input.items[0].productId).toBe('42');
        return { recordInventoryReconciliation: [{ id: '7' }] };
      },
    });
    const saved = await database.collection('products').get(record.id);
    expect(saved.syncStatus).toBe('SYNCED');
    expect(saved.payload).toMatchObject({ id: '42', name: 'Updated tea', stock: 4, taxRate: 5 });
    expect(await api.findById(created.entityId)).toMatchObject({ id: '42', name: 'Updated tea' });
    expect(await api.findById('42')).toMatchObject({ id: '42', name: 'Updated tea' });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
});

test('product field refresh includes the master units store and keeps product conversions separate', async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `inventory-references-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'manager', storeIds: ['b'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  let requests = 0;
  const api = createInventoryApi({
    getSession: () => ({ token: 'token', tenant: { id: 't' }, user: { id: 'u' } }),
    getDatabase: () => database,
    scopeKey: () => 'scope',
    request: async () => {
      requests++;
      return {
        categories: [{ id: '1', name: 'Goods' }],
        units: [{ id: '2', name: 'Piece', code: 'PCS' }],
        taxes: [{ id: '3', name: 'GST', percentage: 5 }],
      };
    },
    billing: { load: async () => ({ key: 'scope', cache: {} }), refresh: async () => {} },
  });
  try {
    await applyBootstrapCollections(database, {
      productUoms: [{ id: 'conversion', productId: '10', factor: 12 }],
    });
    const conversions = await database.collection('product_uoms').list();
    const result = await api.loadProductReferences(true);
    expect(result).toMatchObject({
      categories: [{ id: 1, name: 'Goods' }],
      units: [{ id: 2, name: 'Piece', code: 'PCS' }],
      taxes: [{ id: 3, name: 'GST', percentage: 5 }],
    });
    expect((await database.collection('units').list())[0].payload.name).toBe('Piece');
    expect(await database.collection('product_uoms').list()).toEqual(conversions);
    expect(await api.loadProductReferences(false)).toEqual(result);
    expect(requests).toBe(1);
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
});

test('every sale-price edit is retained offline and stock-only edits do not add price history', async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `inventory-price-history-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'manager', storeIds: ['b'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  const api = createInventoryApi({
    getSession: () => ({ token: 'token', tenant: { id: 't' }, user: { id: 'u' } }),
    getDatabase: () => database,
    scopeKey: () => 'scope',
    request: async () => {
      throw new Error('offline');
    },
    billing: { load: async () => ({ key: 'scope', cache: {} }), refresh: async () => {} },
  });
  try {
    const input = { name: 'Tea', price: 90, mrp: 100, costPrice: 60, stock: 2.5, iconKey: 'package' };
    await api.create(input);
    const [record] = await database.collection('products').list();
    expect(record.payload.details.batches).toBeUndefined();
    expect(record.payload.details.mrp).toBe(100);
    const [queued] = await database.collection('sync_outbox').list();
    const command = queued.payload.request.variables.newProductData;
    expect(command).toMatchObject({ price: 90, mrp: 100, quantity: 2.5, stockLevels: [] });
    expect(command.details.mrp).toBeUndefined();
    expect(command.details.batches).toBeUndefined();
    expect(command.details.mrpPriceHistory).toBeUndefined();
    for (const price of [95, 85, 95]) await api.update({ ...input, productId: record.payload.id, price });
    const saved = (await database.collection('products').get(record.id)).payload;
    expect(saved.details.mrpPriceHistory.map((entry) => entry.price)).toEqual([90, 95, 85, 95]);
    expect(saved.details.mrpPriceHistory.at(-1).oldPrice).toBe(85);
    expect(await api.latestPrice(record.payload.id)).toBe(95);
    await api.update({ ...input, productId: record.payload.id, price: 95, stock: 3 });
    const counted = (await database.collection('products').get(record.id)).payload;
    expect(counted.details.mrpPriceHistory).toHaveLength(4);
    await api.update({
      ...input,
      productId: record.payload.id,
      price: 95,
      stock: 3,
      mrp: undefined,
      details: { ...counted.details, mrp: null },
    });
    expect((await database.collection('products').get(record.id)).payload.details.mrp).toBeNull();
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
});
