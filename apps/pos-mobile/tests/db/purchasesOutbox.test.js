import 'fake-indexeddb/auto';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { expect, test } from 'bun:test';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createTableMutation } from '@indyzai/pos-database/table-mutations';
import { createPurchasesApi } from '@indyzai/feature-purchase/purchasesApi';

const draft = {
  id: 'local-po',
  supplierName: 'Supplier',
  status: 'DRAFT',
  total: 110,
  createdAt: '2026-09-22T10:00:00Z',
  items: [
    { productId: '5', productName: 'Product', quantity: 1, purchasePrice: 100, taxRate: 10, unit: 'box' },
  ],
};
async function withApi(work) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `purchase-outbox-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'manager', storeIds: ['1'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  const calls = [];
  let response = async (query) =>
    query.includes('savePurchase')
      ? { savePurchase: { id: '99', purchaseNumber: 'PO-99' } }
      : { purchases: [] };
  const api = createPurchasesApi({
    getContext: () => ({ database, scope: 'test', tenant: 't', token: 'token' }),
    request: async (_token, _tenant, query, variables) => {
      calls.push(variables);
      return response(query);
    },
  });
  try {
    await work({
      database,
      api,
      calls,
      setResponse: (fn) => {
        response = fn;
      },
    });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}

test('purchase creation then offline edit use separate mutation IDs and resolve the server ID', async () => {
  await withApi(async ({ database, api, calls }) => {
    const config = { table: 'purchase_orders', entityType: 'PURCHASE' };
    const first = await createTableMutation(database, config, {
      localId: draft.id,
      operation: 'CREATE',
      payload: draft,
    });
    const second = await createTableMutation(database, config, {
      localId: draft.id,
      operation: 'UPDATE',
      payload: { ...draft, supplierName: 'Updated supplier' },
    });
    await api.pushPending();
    await api.pushPending();
    expect(calls).toHaveLength(2);
    expect(calls[0].newPurchaseData.id).toBeUndefined();
    expect(calls[1].newPurchaseData.id).toBe(99);
    expect(calls[1].newPurchaseData.supplierName).toBe('Updated supplier');
    expect(calls[0].newPurchaseData.clientMutationId).toBe(first.job.payload.idempotencyKey);
    expect(calls[1].newPurchaseData.clientMutationId).toBe(second.job.payload.idempotencyKey);
    const saved = await database.collection('purchase_orders').get(draft.id);
    expect(saved.syncStatus).toBe('SYNCED');
    expect(saved.payload.items[0].taxRate).toBe(10);
  });
});

test('failed purchase keeps the mutation ID for retry', async () => {
  await withApi(async ({ database, api, calls, setResponse }) => {
    await createTableMutation(
      database,
      { table: 'purchase_orders', entityType: 'PURCHASE' },
      { localId: draft.id, operation: 'CREATE', payload: draft },
    );
    setResponse(async () => {
      throw new Error('Offline');
    });
    await expect(api.pushPending()).rejects.toThrow('Offline');
    await expect(api.pushPending()).rejects.toThrow('Offline');
    expect(calls[0].newPurchaseData.clientMutationId).toBe(calls[1].newPurchaseData.clientMutationId);
    expect((await database.collection('sync_outbox').list())[0].syncStatus).toBe('PENDING');
  });
});

test('purchase stops retrying and marks as FAILED after 3 failed attempts', async () => {
  await withApi(async ({ database, api, calls, setResponse }) => {
    await createTableMutation(
      database,
      { table: 'purchase_orders', entityType: 'PURCHASE' },
      { localId: draft.id, operation: 'CREATE', payload: draft },
    );
    setResponse(async () => {
      throw new Error('Purchase rejected');
    });
    // 1st failure
    await expect(api.pushPending()).rejects.toThrow('Purchase rejected');
    let job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('PENDING');
    expect(job.payload.attempts).toBe(1);

    // 2nd failure
    await expect(api.pushPending()).rejects.toThrow('Purchase rejected');
    job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('PENDING');
    expect(job.payload.attempts).toBe(2);

    // 3rd failure
    await expect(api.pushPending()).rejects.toThrow('Purchase rejected');
    job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('FAILED');
    expect(job.payload.attempts).toBe(3);
    expect(job.payload.errorMessage).toBe('Purchase rejected');

    // Subsequent pushPending skips
    const callsCount = calls.length;
    await api.pushPending();
    expect(calls.length).toBe(callsCount);
  });
});
