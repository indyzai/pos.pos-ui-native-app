import 'fake-indexeddb/auto';
import { expect, mock, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { setActiveDatabase } from '@indyzai/pos-database';
import { CanonicalJobDatabase, startNativeSyncRuntime } from '@indyzai/pos-sync-native';
import { commitCheckout, acknowledgeCheckout } from '@indyzai/feature-billing/checkout';

const session = {
  token: 'token',
  tenant: { id: 'tenant' },
  user: { id: 'user' },
  organization: { branches: [{ id: '1', name: 'Main', counters: [{ id: '2', name: 'Front' }] }] },
};
mock.module('@indyzai/pos-auth/session', () => ({ getActiveAuthSession: () => session }));
const { queueOpenCounter, queuePettyCash, queueCloseCounter } = await import(
  '@indyzai/feature-organization/counterSessionApi'
);

test('offline counter cash, bill and close retain local totals and replay in dependency order', async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `counter-offline-${crypto.randomUUID()}`;
  const raw = new IndexedDbLocalDatabase(
    { tenantId: 'tenant', userId: 'user', role: 'manager', storeIds: ['1'], deviceId: 'device' },
    name,
  );
  await raw.initialize();
  const database = new CanonicalJobDatabase(raw);
  await database.migrate();
  setActiveDatabase(database);
  let runtime;
  try {
    const opened = await queueOpenCounter('tenant', '2', 100);
    const transaction = database.transaction.bind(database);
    database.transaction = (tables, work) =>
      transaction(tables, async (tx) => {
        await work(tx);
        throw new Error('Disk full');
      });
    try {
      await expect(
        queuePettyCash('tenant', {
          type: 'INCOME',
          amount: 99,
          counterSessionId: opened.record.id,
        }),
      ).rejects.toThrow('Disk full');
    } finally {
      database.transaction = transaction;
    }
    expect(await database.collection('petty_cash_entries').list()).toHaveLength(0);
    expect((await database.collection('shifts').get(opened.record.id)).payload.salesSummary).toBeUndefined();

    await queuePettyCash('tenant', { type: 'INCOME', amount: 10, counterSessionId: opened.record.id });
    await queuePettyCash('tenant', { type: 'EXPENSE', amount: 3, counterSessionId: opened.record.id });
    await commitCheckout(
      database,
      {
        id: 'sale-cash',
        receiptNumber: 'LOCAL-1',
        createdAt: new Date().toISOString(),
        input: {
          offlineId: 'sale-cash',
          counterSessionId: opened.record.id,
          items: [{ productId: '1', quantity: 1 }],
          payments: [{ paymentMethod: 'CASH', amountPaid: 20 }],
          totalAmount: 20,
        },
      },
      [],
    );
    const localShift = () => database.collection('shifts').get(opened.record.id);
    expect((await localShift()).payload).toMatchObject({
      expectedBalance: 127,
      salesSummary: { cash: 20, miscIncome: 10, miscExpense: 3, totalSales: 20 },
    });
    await queueCloseCounter('tenant', opened.record.id, 127);
    expect((await localShift()).payload.status).toBe('CLOSED');
    let online = false;
    const calls = [];
    runtime = startNativeSyncRuntime({
      database,
      credentials: () => ({ token: 'token', tenantId: 'tenant', userId: 'user' }),
      assertCurrent() {},
      isOnline: () => online,
      afterSaleAcknowledged: acknowledgeCheckout,
      request: async (_credentials, query, variables) => {
        if (query.includes('mutation OpenCounter')) {
          calls.push('open');
          return { openCounter: { id: '42', status: 'OPEN' } };
        }
        if (query.includes('mutation RecordCounterPettyCash')) {
          expect(variables.input.counterSessionId).toBe('42');
          expect(typeof variables.input.clientMutationId).toBe('string');
          calls.push(variables.input.type);
          return { recordMiscellaneousTransaction: true };
        }
        if (query.includes('mutation CreateBill')) {
          expect(variables.newBillData.counterSessionId).toBe(42);
          calls.push('bill');
          return { saveBill: { id: '43', billId: 'INV-43' } };
        }
        expect(variables.sessionId).toBe(42);
        calls.push('close');
        return { closeCounter: { id: '42', status: 'CLOSED' } };
      },
    });
    await runtime.syncNow();
    expect(calls).toEqual([]);
    online = true;
    await runtime.syncNow();
    expect(calls).toEqual(['open', 'INCOME', 'EXPENSE', 'bill', 'close']);
    expect((await runtime.engine.listJobs()).every((job) => job.status === 'synced')).toBe(true);
    expect((await localShift()).payload).toMatchObject({
      id: '42',
      status: 'CLOSED',
      expectedBalance: 127,
      salesSummary: { cash: 20, miscIncome: 10, miscExpense: 3, totalSales: 20 },
    });
  } finally {
    await runtime?.stopAndWait();
    setActiveDatabase(null);
    await database.close();
    await Dexie.delete(name);
  }
});
