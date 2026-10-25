import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { test, expect } from 'bun:test';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createScopeKey } from '@indyzai/pos-database';
import { applyRefreshBatch } from '../../../../vendor/pos-ui-shared/packages-native/database/src/refresh';
import { createPrinterManagementApi } from '../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/managementApi';
async function fixture(work) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'manager', storeIds: ['b'], deviceId: 'd' },
    `printer-jobs-${crypto.randomUUID()}`,
  );
  await database.initialize();
  const scope = createScopeKey(database.scope);
  let token = 'token';
  const getContext = () => ({ database, scope, token, tenant: 't' });
  const put = (payload) =>
    database.collection('print_jobs').put({
      id: payload.id,
      scope,
      tenantId: 't',
      payload,
      syncStatus: 'SYNCED',
      updatedAt: 1,
      serverVersion: 0,
    });
  try {
    await work({
      database,
      scope,
      getContext,
      put,
      switchSession: () => {
        token = 'other';
      },
    });
  } finally {
    await database.close();
  }
}
test('refresh merges server jobs while preserving uncertain device outcomes and rejects stale responses', async () => {
  await fixture(async ({ database, put, getContext, switchSession }) => {
    await put({ id: 'native', deliveryState: 'UNCERTAIN', printerName: 'Desk' });
    const api = createPrinterManagementApi({
      getContext,
      request: async () => ({ printerJobs: [{ id: '42', status: 'FAILED', printerName: 'Remote' }] }),
    });
    await api.refreshJobs();
    await api.refreshJobs();
    const jobs = await database.collection('print_jobs').list();
    expect(jobs).toHaveLength(2);
    expect(jobs.find((row) => row.payload.id === '42').payload.historyOnly).toBe(true);
    expect(jobs.find((row) => row.payload.id === 'native').payload.deliveryState).toBe('UNCERTAIN');
    const stale = createPrinterManagementApi({
      getContext,
      request: async () => {
        switchSession();
        return { printerJobs: [{ id: 'wrong' }] };
      },
    });
    await expect(stale.refreshJobs()).rejects.toThrow();
    expect(await database.collection('print_jobs').list()).toHaveLength(2);
  });
});
test('full update-tree printer snapshots retain device activity and mark history as read-only', async () => {
  await fixture(async ({ database, put }) => {
    await put({ id: 'native', deliveryState: 'SENT', printerName: 'Desk' });
    await put({ id: 'pending', status: 'QUEUED', invoiceNumber: 'INV-1' });
    const node = {
      key: 'pos.printer.printerJobs',
      resourceKey: 'printerJobs',
      type: 'collection',
      partitionKey: '-',
      requiredRevision: '1',
      availableRevision: '1',
      updatedAt: '2026-10-25T00:00:00Z',
      dependsOn: [],
    };
    await applyRefreshBatch(
      database,
      {
        node,
        rows: [{ id: 'remote', status: 'QUEUED' }],
        deletedIds: [],
        mode: 'snapshot',
        marker: {
          nodeKey: node.key,
          partitionKey: '-',
          treeVersion: 1,
          appliedRevision: '1',
          serverUpdatedAt: node.updatedAt,
        },
      },
      new AbortController().signal,
    );
    const jobs = await database.collection('print_jobs').list();
    expect(jobs.find((row) => row.payload.id === 'native').payload.deliveryState).toBe('SENT');
    expect(jobs.find((row) => row.payload.id === 'remote').payload.historyOnly).toBe(true);
    expect(jobs.find((row) => row.payload.id === 'pending').payload.status).toBe('QUEUED');
  });
});

test('job previews use a stored document without network access and load older invoice references', async () => {
  await fixture(async ({ getContext }) => {
    let requests = 0;
    const receipt = {
      id: '1',
      billId: 'INV-1',
      saleDate: '2026-10-25',
      subtotal: 20,
      discountAmount: 2,
      taxAmount: 0,
      totalAmount: 18,
      items: [
        { productId: 'p', name: 'Cable', quantity: 2, unitPrice: 10, discountAmount: 2, lineTotal: 18 },
      ],
      payments: [{ paymentMethod: 'CASH', amountPaid: 18 }],
    };
    const api = createPrinterManagementApi({
      getContext,
      receiptContext: () => ({ businessName: 'Shop', currencyCode: 'INR' }),
      request: async () => {
        requests++;
        return { bill: receipt };
      },
    });
    const snapshot = { kind: 'receipt', title: 'Original Shop', lines: ['Receipt INV-1'] };
    expect((await api.preview({ id: 'native', document: snapshot })).document).toEqual(snapshot);
    expect(requests).toBe(0);
    const preview = await api.preview({ id: 'remote', documentType: 'receipt', invoiceNumber: 'INV-1' });
    expect(preview.document.lines.join('\n')).toContain('TOTAL: INR 18.00');
    expect(preview.document.lines.join('\n')).toContain('2 x INR 10.00 = INR 18.00');
    expect(requests).toBe(1);
    expect(await api.preview({ id: 'older', documentType: 'barcode' })).toBeUndefined();
  });
});

test('legacy update-tree job references can load receipt previews', async () => {
  await fixture(async ({ getContext, put, database }) => {
    const api = createPrinterManagementApi({
      getContext,
      receiptContext: () => ({ businessName: 'Shop', currencyCode: 'INR' }),
      request: async (_token, _tenant, _query, variables) => {
        expect(variables.id).toBe('BILL-OLD');
        return {
          bill: {
            id: '1',
            billId: 'BILL-OLD',
            saleDate: '2026-10-25',
            subtotal: 0,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: 0,
            items: [],
          },
        };
      },
    });
    const result = await api.preview({ id: '42', documentType: 'RECEIPT', documentReference: 'BILL-OLD' });
    expect(result.document.receipt.id).toBe('BILL-OLD');
  });
});
