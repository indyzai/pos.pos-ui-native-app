import 'fake-indexeddb/auto';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { expect, test } from 'bun:test';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createTableMutation } from '@indyzai/pos-database/table-mutations';
import { createScopeKey } from '../../../../packages/database/src/types';
import { createPrinterConfigurationApi } from '@indyzai/feature-printers/configuration';

const printer = {
  id: 'local-printer',
  name: 'Label printer',
  counterId: '2',
  branchId: '1',
  type: 'shipping_label',
  printerTypes: ['shipping_label'],
  connectionType: 'network',
  address: '192.168.1.10',
  port: '9100',
  paperSize: '100x150mm',
  status: 'UNKNOWN',
  isDefault: true,
  isActive: true,
  copies: 2,
  autoPrint: false,
  config: {
    native: {
      model: 'CD410-UB',
      language: 'TSPL',
      widthMm: 100,
      heightMm: 150,
      gapMm: 2,
      dpi: 203,
      copies: 2,
      autoCut: false,
    },
  },
};
async function withApi(work) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `printer-test-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { appProfile: 'admin', tenantId: 't', userId: 'u', role: 'admin', storeIds: ['1'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  let session = {
    token: 'token',
    tenant: { id: 't', name: 'Shop', role: 'admin' },
    user: { id: 'u', email: 'admin@example.test', role: 'admin' },
    organization: {
      id: 't',
      name: 'Shop',
      settings: {},
      activeSession: null,
      branches: [{ id: '1', name: 'Branch', counters: [{ id: '2', name: 'Counter' }] }],
    },
  };
  const calls = [];
  let handler = async (query) =>
    query.includes('CreateNativePrinter')
      ? { createCounterPrinter: { ...printer, id: '99' } }
      : query.includes('UpdateNativePrinter')
        ? { updateCounterPrinter: { ...printer, id: '99' } }
        : { counterPrinters: [] };
  const api = createPrinterConfigurationApi(
    async (_token, _tenant, query, variables) => {
      calls.push({ query, variables });
      return handler(query, variables);
    },
    'admin',
    () => ({ database, session, scope: createScopeKey(database.scope) }),
  );
  try {
    await work({
      database,
      api,
      calls,
      setHandler: (value) => (handler = value),
      switchSession: () => (session = { ...session, token: 'other' }),
    });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}
const queue = (database) =>
  createTableMutation(
    database,
    { table: 'printers', entityType: 'PRINTER' },
    { payload: printer, localId: printer.id, operation: 'CREATE', storeId: '1' },
  );

test('printer creation saves counter mapping and copies then resolves local identity', async () => {
  await withApi(async ({ database, api, calls }) => {
    await queue(database);
    // Model the legacy SQLite NOT NULL remote_id fallback explicitly.
    const row = await database.collection('printers').get(printer.id);
    await database.collection('printers').put({ ...row, remoteId: printer.id });
    await api.pushPending();
    expect(calls).toHaveLength(3);
    expect(calls[1].variables.input.config.clientPrinterId).toBe(printer.id);
    expect(calls[1].variables.input.counterId).toBe('2');
    expect(calls[2].variables.input.copies).toBe(2);
    expect((await database.collection('printers').get(printer.id)).remoteId).toBe('99');
    expect((await database.collection('sync_outbox').list())[0].syncStatus).toBe('SYNCED');
  });
});
test('uncertain create cannot duplicate even when manual retry resets attempts', async () => {
  await withApi(async ({ database, api, calls, setHandler }) => {
    await queue(database);
    setHandler(async (query) => {
      if (query.includes('CreateNativePrinter')) throw new Error('Connection lost after send');
      return { counterPrinters: [] };
    });
    await api.pushPending();
    const job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('FAILED');
    await database
      .collection('sync_outbox')
      .put({ ...job, syncStatus: 'PENDING', payload: { ...job.payload, attempts: 0 } });
    await api.pushPending();
    expect(calls.filter((call) => call.query.includes('CreateNativePrinter'))).toHaveLength(1);
    expect((await database.collection('sync_outbox').list())[0].payload.errorMessage).toContain('uncertain');
  });
});
test('lost create acknowledgement recovers server ID by durable marker', async () => {
  await withApi(async ({ database, api, calls, setHandler }) => {
    await queue(database);
    const job = (await database.collection('sync_outbox').list())[0];
    await database
      .collection('sync_outbox')
      .put({ ...job, syncStatus: 'RUNNING', payload: { ...job.payload, attempts: 1 } });
    setHandler(async (query) =>
      query.includes('NativePrinters')
        ? {
            counterPrinters: [
              {
                ...printer,
                id: '99',
                config: { ...printer.config, clientPrinterId: printer.id },
              },
            ],
          }
        : { updateCounterPrinter: { ...printer, id: '99' } },
    );
    await api.refresh('2');
    expect(await database.collection('printers').list()).toHaveLength(1);
    await api.pushPending();
    expect(calls.some((call) => call.query.includes('CreateNativePrinter'))).toBe(false);
    expect((await database.collection('sync_outbox').list())[0].syncStatus).toBe('SYNCED');
  });
});
test('background refresh does not overwrite an offline edit or another account', async () => {
  await withApi(async ({ database, api, setHandler, switchSession }) => {
    await queue(database);
    setHandler(async () => ({
      counterPrinters: [
        {
          ...printer,
          id: '99',
          name: 'Server name',
          config: { ...printer.config, clientPrinterId: printer.id },
        },
      ],
    }));
    await api.refresh('2');
    expect((await database.collection('printers').get(printer.id)).payload.name).toBe(printer.name);
    setHandler(async () => {
      switchSession();
      return { counterPrinters: [] };
    });
    await expect(api.refresh()).rejects.toThrow('Workspace changed');
    expect(await database.collection('printers').list()).toHaveLength(1);
  });
});
