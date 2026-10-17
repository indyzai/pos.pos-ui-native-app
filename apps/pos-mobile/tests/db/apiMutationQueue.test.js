import { registerNativeCommandTransport } from '@indyzai/pos-api/commands';
import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { queueApiMutation, pushApiMutations, retryApiMutation } from '@indyzai/pos-sync-native';

registerNativeCommandTransport('test:0', 'mutation Create { create { id } }');
registerNativeCommandTransport('test:1', 'mutation Update { update { id } }');
registerNativeCommandTransport('test:2', 'mutation OpenCounter');
registerNativeCommandTransport('test:3', 'mutation SaveBill');
registerNativeCommandTransport('test:4', 'mutation CloseCounter');

async function fixture(work) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `api-mutation-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 'tenant', userId: 'user', role: 'manager', storeIds: ['branch'], deviceId: 'device' },
    name,
  );
  await database.initialize();
  try {
    await work(database, name);
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}
const command = (localId, data = {}) => ({
  operation: 'CREATE',
  localId,
  payload: { id: localId, name: 'Tea', ...data },
  request: {
    query: 'mutation Create { create { id } }',
    variables: { input: { name: 'Tea' } },
    resultPath: 'create',
  },
});

test('queued commands survive reopening and a lost response reuses the same key', async () => {
  await fixture(async (database, name) => {
    const { job } = await queueApiMutation(database, { table: 'products' }, command('offline-tea'));
    await database.close();
    const reopened = new IndexedDbLocalDatabase(database.scope, name);
    await reopened.initialize();
    const keys = [];
    let attempts = 0;
    const options = {
      database: reopened,
      assertCurrent: () => {},
      request: async (_query, variables) => {
        keys.push(variables.clientMutationId);
        if (++attempts === 1) throw new Error('lost response');
        return { create: { id: '42' } };
      },
    };
    await expect(pushApiMutations(options)).rejects.toThrow('lost response');
    expect((await reopened.collection('products').get('offline-tea')).syncStatus).toBe('PENDING');
    await pushApiMutations(options);
    expect(keys).toEqual([job.payload.idempotencyKey, job.payload.idempotencyKey]);
    expect((await reopened.collection('products').get('offline-tea')).payload.id).toBe('42');
    expect((await reopened.collection('sync_outbox').get(job.id)).syncStatus).toBe('SYNCED');
    await reopened.close();
  });
});

test('create followed by an offline edit rewrites the persisted child request and preserves the newer edit', async () => {
  await fixture(async (database) => {
    await queueApiMutation(database, { table: 'products' }, command('offline-tea'));
    await queueApiMutation(
      database,
      { table: 'products' },
      {
        operation: 'UPDATE',
        localId: 'offline-tea',
        payload: { id: 'offline-tea', name: 'Updated tea' },
        request: {
          query: 'mutation Update { update { id } }',
          variables: { id: 'offline-tea' },
          resultPath: 'update',
          mergeResult: false,
        },
      },
    );
    const calls = [];
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async (query, variables) => {
        calls.push(variables);
        return query.includes('Create') ? { create: { id: '42', name: 'Tea' } } : { update: { id: '42' } };
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1].id).toBe('42');
    const row = await database.collection('products').get('offline-tea');
    expect(row.payload.name).toBe('Updated tea');
    expect(row.syncStatus).toBe('SYNCED');
  });
});

test('failed acknowledgements retain jobs, block dependent requests and support explicit retry', async () => {
  await fixture(async (database) => {
    const { job } = await queueApiMutation(database, { table: 'users' }, command('offline-user'));
    await queueApiMutation(
      database,
      { table: 'shifts' },
      {
        ...command('offline-shift'),
        request: { ...command('x').request, variables: { input: { userId: 'offline-user' } } },
      },
    );
    let calls = 0;
    for (let i = 0; i < 3; i++)
      await expect(
        pushApiMutations({
          database,
          assertCurrent: () => {},
          request: async () => {
            calls++;
            return { create: null };
          },
        }),
      ).rejects.toThrow('acknowledge');
    expect(calls).toBe(3);
    expect((await database.collection('sync_outbox').get(job.id)).syncStatus).toBe('FAILED');
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async () => {
        throw new Error('Should not send failed jobs or their children');
      },
    });
    await retryApiMutation(database, job.payload.offlineId);
    expect((await database.collection('sync_outbox').get(job.id)).payload.attempts).toBe(0);
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async () => ({ create: { id: '7' } }),
    });
    expect(
      (await database.collection('sync_outbox').list()).every((row) => row.syncStatus === 'SYNCED'),
    ).toBe(true);
  });
});

test('late responses after a workspace switch cannot acknowledge local data', async () => {
  await fixture(async (database) => {
    const { job } = await queueApiMutation(database, { table: 'users' }, command('offline-user'));
    let current = true;
    await expect(
      pushApiMutations({
        database,
        assertCurrent: () => {
          if (!current) throw new Error('Workspace changed');
        },
        request: async () => {
          current = false;
          return { create: { id: '42' } };
        },
      }),
    ).rejects.toThrow('Workspace changed');
    expect((await database.collection('sync_outbox').get(job.id)).syncStatus).toBe('RUNNING');
    expect((await database.collection('users').get('offline-user')).remoteId).toBeNull();
  });
});

test('stock projections and command persistence roll back together when the outbox write fails', async () => {
  await fixture(async (database) => {
    const { record } = await queueApiMutation(
      database,
      { table: 'products' },
      command('offline-product', { stock: 5 }),
    );
    const transaction = database.transaction.bind(database);
    database.transaction = (tables, work) =>
      transaction(tables, async (tx) => {
        const collection = tx.collection.bind(tx);
        tx.collection = (name) => {
          const repository = collection(name);
          if (name === 'sync_outbox')
            repository.put = async () => {
              throw new Error('disk full');
            };
          return repository;
        };
        return work(tx);
      });
    await expect(
      queueApiMutation(
        database,
        { table: 'stock_counts' },
        {
          ...command('offline-count'),
          relatedRecords: [
            { table: 'products', record: { ...record, payload: { ...record.payload, stock: 2 } } },
          ],
        },
      ),
    ).rejects.toThrow('disk full');
    database.transaction = transaction;
    expect((await database.collection('products').get('offline-product')).payload.stock).toBe(5);
    expect(await database.collection('stock_counts').get('offline-count')).toBeUndefined();
  });
});

test('concurrent triggers send a command once and erase replay-only fields after success', async () => {
  await fixture(async (database) => {
    const input = command('offline-user');
    input.request.variables.details = { pin: '1234' };
    const { job } = await queueApiMutation(database, { table: 'users' }, input);
    let calls = 0;
    const options = {
      database,
      assertCurrent: () => {},
      request: async () => {
        calls++;
        return { create: { id: '42' } };
      },
    };
    await Promise.all([pushApiMutations(options), pushApiMutations(options)]);
    expect(calls).toBe(1);
    expect((await database.collection('sync_outbox').get(job.id)).payload.request).toBeUndefined();
  });
});

test('an offline counter open, sale, and close replay in dependency order with numeric server IDs', async () => {
  await fixture(async (database) => {
    const opened = await queueApiMutation(
      database,
      { table: 'shifts' },
      {
        ...command('offline-counter'),
        request: {
          query: 'mutation OpenCounter',
          variables: { input: { counterId: '3' } },
          numericIdPaths: ['input.counterId'],
          resultPath: 'openCounter',
        },
      },
    );
    const sale = await queueApiMutation(
      database,
      { table: 'sales' },
      {
        ...command('offline-sale'),
        request: {
          query: 'mutation SaveBill',
          variables: { input: { counterSessionId: 'offline-counter' } },
          numericIdPaths: ['input.counterSessionId'],
          resultPath: 'saveBill',
        },
      },
    );
    await queueApiMutation(
      database,
      { table: 'shifts' },
      {
        ...command('offline-counter', { status: 'CLOSED' }),
        operation: 'UPDATE',
        dependencies: [{ jobId: sale.job.payload.offlineId }],
        request: {
          query: 'mutation CloseCounter',
          variables: { sessionId: 'offline-counter' },
          numericIdPaths: ['sessionId'],
          resultPath: 'closeCounter',
        },
      },
    );
    const calls = [];
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async (query, variables) => {
        calls.push({ query, variables });
        return query.includes('Open')
          ? { openCounter: { id: '9', status: 'OPEN' } }
          : query.includes('Save')
            ? { saveBill: { id: '10' } }
            : { closeCounter: { id: '9', status: 'CLOSED' } };
      },
    });
    expect(calls.map((call) => call.query)).toEqual([
      'mutation OpenCounter',
      'mutation SaveBill',
      'mutation CloseCounter',
    ]);
    expect(calls[1].variables.input.counterSessionId).toBe(9);
    expect(calls[2].variables.sessionId).toBe(9);
    expect((await database.collection('shifts').get(opened.record.id)).payload.status).toBe('CLOSED');
  });
});

test('refund creation persists a sync job and leaves transport to the worker', async () => {
  const { setActiveDatabase } = await import('@indyzai/pos-database');
  const { createOrdersApi } = await import('@indyzai/feature-orders/ordersApi');
  const { ordersRepository } = await import('@indyzai/feature-orders/ordersRepository');
  await fixture(async (database) => {
    setActiveDatabase(database);
    let requests = 0;
    const api = createOrdersApi({
      repository: ordersRepository,
      createId: () => 'refund-local',
      getContext: () => ({ scope: 'scope', tenant: 'tenant', token: 'token' }),
      request: async () => {
        requests++;
        throw new Error('Offline');
      },
    });
    try {
      const order = {
        id: '1',
        billId: 'B-1',
        items: [
          {
            productId: '42',
            name: 'Tea',
            quantity: 2,
            unitPrice: 10,
            lineTotal: 20,
            discountAmount: 0,
            taxAmount: 0,
          },
        ],
      };
      const refund = await api.createRefund(order, [{ productId: '42', quantity: 1 }], 'Return', 'CASH');
      expect(refund.total).toBe(10);
      expect(requests).toBe(0);
      expect((await database.collection('sync_outbox').list())[0].payload.request.resultPath).toBe(
        'createSaleRefund',
      );
      await api.sync();
      expect(requests).toBe(0);
    } finally {
      setActiveDatabase(null);
    }
  });
});
