import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createScopeKey } from '@indyzai/pos-database';
import { createMetadataApi } from '@indyzai/feature-catalog/metadataApi';
async function withApi(work) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `metadata-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { appProfile: 'admin', tenantId: 't', userId: 'u', role: 'admin', storeIds: [], deviceId: 'd' },
    name,
  );
  await database.initialize();
  const calls = [];
  let token = 'token';
  let response = async (query, variables) => {
    if (query.includes('mutation')) {
      const field = query.includes('createUnit')
        ? 'createUnit'
        : query.includes('createCategory')
          ? 'createCategory'
          : 'createTax';
      return { [field]: { ...variables.data, id: '42' } };
    }
    return { units: [], categories: [], taxes: [] };
  };
  const api = createMetadataApi({
    getContext: () => ({ database, scope: createScopeKey(database.scope), tenant: 't', token }),
    createId: () => crypto.randomUUID(),
    request: async (_token, _tenant, query, variables) => {
      calls.push({ query, variables });
      return response(query, variables);
    },
  });
  try {
    await work({
      api,
      database,
      calls,
      setResponse: (fn) => {
        response = fn;
      },
      switchSession: () => {
        token = 'changed';
      },
    });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}
for (const [kind, input] of [
  ['units', { name: ' Kilogram ', code: ' kg ', type: 'weight' }],
  ['categories', { name: ' Services ', type: 'SERVICE' }],
  ['tax_rates', { name: ' Tax ', percentage: 18 }],
]) {
  test(`${kind}: creates durably without network and resolves the same local record`, async () =>
    withApi(async ({ api, database, calls }) => {
      const item = (await api.create(kind, input)).record;
      expect(calls).toHaveLength(0);
      expect((await database.collection(kind).get(item.id)).syncStatus).toBe('PENDING');
      const job = (await database.collection('sync_outbox').list())[0];
      await api.pushPending();
      const mutation = calls.find((call) => call.query.includes('mutation'));
      if (kind !== 'tax_rates')
        expect(mutation.variables.data.clientMutationId).toBe(job.payload.idempotencyKey);
      expect((await database.collection(kind).get(item.id)).remoteId).toBe('42');
      expect((await database.collection(kind).get(item.id)).syncStatus).toBe('SYNCED');
      expect(await database.collection(kind).list()).toHaveLength(1);
      await api.pushPending();
      expect(calls.filter((call) => call.query.includes('mutation'))).toHaveLength(1);
    }));
}
test('failed jobs survive refresh and manual retry retains idempotency key', async () =>
  withApi(async ({ api, database, calls, setResponse }) => {
    const item = (await api.create('units', { name: 'Piece', code: 'pc' })).record;
    const job = (await database.collection('sync_outbox').list())[0];
    setResponse(async () => {
      throw new Error('Offline');
    });
    for (let i = 0; i < 3; i++) await expect(api.pushPending()).rejects.toThrow('Offline');
    expect((await database.collection('units').get(item.id)).syncStatus).toBe('FAILED');
    setResponse(async () => ({ units: [] }));
    await api.refresh('units');
    expect((await database.collection('units').get(item.id)).payload.name).toBe('Piece');
    await api.retry('units', item.id);
    expect((await database.collection('sync_outbox').get(job.id)).payload.idempotencyKey).toBe(
      job.payload.idempotencyKey,
    );
    setResponse(async (_query, variables) => ({ createUnit: { ...variables.data, id: 9 } }));
    await api.pushPending();
    expect(calls.at(-1).variables.data.clientMutationId).toBe(job.payload.idempotencyKey);
    expect((await database.collection('units').get(item.id)).syncStatus).toBe('SYNCED');
  }));
test('tax retry reconciles a server create whose response was lost', async () =>
  withApi(async ({ api, database, calls, setResponse }) => {
    const item = (await api.create('tax_rates', { name: 'Tax', percentage: 18 })).record;
    let taxes = [];
    setResponse(async (query) => {
      if (query.includes('mutation')) {
        taxes = [{ id: 5, name: 'Tax', percentage: 18 }];
        throw new Error('Response lost');
      }
      return { taxes };
    });
    await expect(api.pushPending()).rejects.toThrow('Response lost');
    await api.pushPending();
    expect(calls.filter((call) => call.query.includes('mutation'))).toHaveLength(1);
    expect((await database.collection('tax_rates').get(item.id)).remoteId).toBe('5');
  }));
test('validation rejects invalid metadata before writing a job', async () =>
  withApi(async ({ api, database }) => {
    await expect(api.create('units', { name: 'Unit', code: ' ' })).rejects.toThrow('code');
    await expect(api.create('categories', { name: 'Category', type: 'invalid' })).rejects.toThrow('type');
    await expect(api.create('tax_rates', { name: 'Tax', percentage: NaN })).rejects.toThrow('percentage');
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  }));
test('late server response cannot modify another workspace', async () =>
  withApi(async ({ api, database, setResponse, switchSession }) => {
    const item = (await api.create('units', { name: 'Unit', code: 'u' })).record;
    setResponse(async () => {
      switchSession();
      return { createUnit: { id: 2, name: 'Unit', code: 'u' } };
    });
    await expect(api.pushPending()).rejects.toThrow('workspace changed');
    expect((await database.collection('units').get(item.id)).remoteId).toBeNull();
  }));

test('queued metadata survives database close and reopen', async () =>
  withApi(async ({ api, database }) => {
    const item = (await api.create('categories', { name: 'Repairs', type: 'SERVICE' })).record;
    const job = (await database.collection('sync_outbox').list())[0];
    await database.close();
    await database.initialize();
    expect((await database.collection('categories').get(item.id)).payload.name).toBe('Repairs');
    expect((await database.collection('sync_outbox').get(job.id)).syncStatus).toBe('PENDING');
    await api.pushPending();
    expect((await database.collection('categories').get(item.id)).syncStatus).toBe('SYNCED');
  }));

test('IndexedDB upgrade preserves master units and product conversions separately', async () => {
  const { prepareLocalIndexedDb } =
    await import('../../../../../vendor/pos-ui-shared/packages/offline-store/src/indexedDbSchema.ts');
  const name = `metadata-upgrade-${crypto.randomUUID()}`;
  const old = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 100);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('product_uoms', { keyPath: 'id' });
      store.put({ id: 'master', payload: { name: 'Kilogram', code: 'kg' } });
      store.put({ id: 'conversion', payload: { name: 'Pack', productId: 'p' } });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  old.close();
  await prepareLocalIndexedDb(name);
  const upgraded = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const read = (table) =>
      new Promise((resolve, reject) => {
        const request = upgraded.transaction(table).objectStore(table).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    expect((await read('units')).map((row) => row.id)).toEqual(['master']);
    expect((await read('product_uoms')).map((row) => row.id).sort()).toEqual(['conversion', 'master']);
  } finally {
    upgraded.close();
    await Dexie.delete(name);
  }
});
