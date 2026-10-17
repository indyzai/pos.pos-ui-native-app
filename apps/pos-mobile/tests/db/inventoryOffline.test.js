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
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
});
