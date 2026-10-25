import { createCustomersApi } from '@indyzai/feature-customers';
import {
  sellerSnapshot,
  waybillSeller,
} from '../../../../vendor/pos-ui-shared/packages-native/feature-organization/src/operations/logisticsSeller';
import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createScopeKey } from '@indyzai/pos-database';
import { pushApiMutations } from '@indyzai/pos-sync-native';
import { createOperationsApi } from '@indyzai/feature-organization/operations-api';
import { validateOperation } from '../../../../vendor/pos-ui-shared/packages-native/feature-organization/src/operations/validation';
import { mergeServiceTechnicians } from '@indyzai/feature-billing/domain/technicians';
import { normalizeLanguage, translateText } from '@indyzai/pos-utils/localization';
async function fixture(work, role = 'manager') {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `operations-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role, storeIds: ['1'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  let token = 'token',
    calls = [];
  let response = async () => ({});
  const context = () => ({
    database,
    scope: createScopeKey(database.scope),
    tenant: 't',
    token,
    role,
    branchId: '1',
    branchIds: ['1', '2'],
    counterId: '2',
    counterSessionId: '3',
  });
  const request = async (_token, _tenant, query, variables) => {
    calls.push({ query, variables });
    return response(query, variables);
  };
  const api = createOperationsApi({ getContext: context, request });
  const put = async (table, payload, status = 'SYNCED') => {
    const row = {
      id: `${table}:${payload.id}`,
      scope: context().scope,
      tenantId: 't',
      remoteId: payload.id,
      payload,
      syncStatus: status,
      serverVersion: 0,
      updatedAt: Date.now(),
    };
    await database.collection(table).put(row);
    return row;
  };
  try {
    await work({
      api,
      context,
      database,
      calls,
      put,
      setResponse: (fn) => {
        response = fn;
      },
      switchSession: () => {
        token = 'other';
      },
      replay: () =>
        pushApiMutations({
          database,
          assertCurrent: () => {},
          request: (query, variables) => request(token, 't', query, variables),
        }),
    });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}
const transfer = {
  fromBranchId: '1',
  toBranchId: '2',
  items: [{ productId: '10', name: 'Product', quantity: 2, unitPrice: 5, available: 10 }],
};
test('transfer validation rejects same branches, empty products, overselling and non-finite quantities', () => {
  expect(validateOperation('transfers', transfer)).toEqual({});
  expect(validateOperation('transfers', { ...transfer, toBranchId: '1' }).toBranchId).toBeDefined();
  for (const quantity of [0, -1, NaN, Infinity, 11])
    expect(
      validateOperation('transfers', { ...transfer, items: [{ ...transfer.items[0], quantity }] }).items,
    ).toBeDefined();
  expect(validateOperation('transfers', { ...transfer, items: [] }).items).toBeDefined();
});
test('transfer creation and status changes survive offline storage and resolve replay dependencies', async () => {
  await fixture(async ({ api, database, calls, replay, setResponse }) => {
    const created = await api.save('transfers', transfer);
    let [row] = await database.collection('transfers').list();
    await api.transition('transfers', row, 'APPROVED');
    expect(calls).toHaveLength(0);
    const jobs = await database.collection('sync_outbox').list();
    expect(jobs).toHaveLength(2);
    expect(jobs.find((job) => job.payload.operation === 'UPDATE').payload.dependencyJobIds).toContain(
      created.jobId,
    );
    setResponse(async (query) =>
      query.includes('NativeCreateLogistics')
        ? { createLogisticsRecord: { id: '42', status: 'PENDING', referenceNumber: 'TR42' } }
        : { updateLogisticsRecord: { id: '42', status: 'APPROVED', referenceNumber: 'TR42' } },
    );
    await replay();
    expect(calls).toHaveLength(2);
    expect(calls[0].variables.input.clientMutationId).toBeTruthy();
    expect(calls[1].variables.id).toBe('42');
    expect((await database.collection('transfers').list())[0].payload.status).toBe('APPROVED');
  });
});
test('branch creation and its details queue as a dependent pair', async () => {
  await fixture(async ({ api, database }) => {
    await api.save('branches', { name: 'New branch', code: 'NEW', businessType: 'retail', isActive: true });
    const jobs = await database.collection('sync_outbox').list();
    expect(jobs).toHaveLength(2);
    const create = jobs.find((job) => job.payload.request.command.includes('createBranch'));
    const update = jobs.find((job) => job.payload.request.command.includes('updateBranch'));
    expect(update.payload.dependencyJobIds).toContain(create.payload.offlineId);
  }, 'admin');
});
test('manager cannot create administrator-only resources', async () => {
  await fixture(async ({ api, database }) => {
    await expect(api.save('branches', { name: 'No' })).rejects.toThrow('access');
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  });
});
test('payment methods reject unlinked defaults and retain bank dependencies across offline creates', async () => {
  expect(
    validateOperation('payments', {
      name: 'UPI',
      code: 'upi',
      isBankRelated: true,
      bankAccountIds: ['1'],
      defaultBankAccountId: '2',
    }).defaultBankAccountId,
  ).toBeDefined();
  await fixture(async ({ api, database }) => {
    const account = await api.save('accounts', {
      accountName: 'Store',
      bankName: 'Bank',
      accountHolderName: 'Owner',
      accountNumber: '12345678',
      isActive: true,
    });
    await api.save('payments', {
      name: 'UPI',
      code: 'upi',
      isActive: true,
      isBankRelated: true,
      bankAccountIds: [account.record.id],
      defaultBankAccountId: account.record.id,
    });
    const jobs = await database.collection('sync_outbox').list();
    expect(jobs.find((job) => job.payload.table === 'payment_methods').payload.dependencyJobIds).toContain(
      account.jobId,
    );
  });
});
test('refresh preserves pending data and refuses responses from a replaced session', async () => {
  await fixture(async ({ api, database, setResponse, switchSession }) => {
    const created = await api.save('transfers', transfer);
    setResponse(async () => ({ logisticsRecords: [] }));
    await api.refresh('transfers');
    expect((await database.collection('transfers').list())[0].payload.id).toBe(created.record.id);
    setResponse(async () => {
      switchSession();
      return { logisticsRecords: [{ id: 'bad', referenceNumber: 'wrong' }] };
    });
    await expect(api.refresh('transfers')).rejects.toThrow();
    expect(await database.collection('transfers').list()).toHaveLength(1);
  });
});
test('scrap sales reserve available stock atomically and reject a second oversale', async () => {
  await fixture(async ({ api, database, put }) => {
    await put('scrap_inventory', {
      id: '5',
      productId: '10',
      name: 'Copper',
      remainingQty: 5,
      stock: 5,
      scrapRate: 10,
    });
    const draft = { partyId: '7', items: [{ productId: '10', name: 'Copper', quantity: 4, unitPrice: 10 }] };
    await api.save('scrapSales', draft);
    expect((await database.collection('scrap_inventory').list())[0].payload.remainingQty).toBe(1);
    await expect(
      api.save('scrapSales', { ...draft, items: [{ ...draft.items[0], quantity: 2 }] }),
    ).rejects.toThrow('stock changed');
    expect(await database.collection('scrap_sales').list()).toHaveLength(1);
    expect(await database.collection('sync_outbox').list()).toHaveLength(1);
  });
});
test('technician contacts override stale service cache without duplicating identities', () => {
  const technicians = mergeServiceTechnicians(
    [{ id: '1', name: 'Old', isActive: true }],
    [
      { id: '1', type: 'TECHNICIAN', name: 'Updated', details: { specialization: 'Repair' } },
      { id: '2', type: 'TECHNICIAN', name: 'Offline' },
      { id: '3', type: 'CUSTOMER', name: 'Customer' },
    ],
  );
  expect(technicians.map((user) => user.name)).toEqual(['Updated', 'Offline']);
  expect(technicians[0].specialization).toBe('Repair');
});
test('native localization follows supported settings and leaves business content unchanged', () => {
  expect(normalizeLanguage('ta-IN')).toBe('ta');
  expect(normalizeLanguage('unknown')).toBe('en');
  expect(translateText('Stock transfers', 'ta')).toBe('சரக்கு மாற்றங்கள்');
  expect(translateText('Bank accounts', 'hi')).toBe('बैंक खाते');
  expect(translateText('Priya Stores 123', 'ta')).toBe('Priya Stores 123');
});

test('a failed branch-details write rolls back both creation jobs and the branch', async () => {
  await fixture(async ({ api, database }) => {
    const prototype = Object.getPrototypeOf(database.collection('stores'));
    const original = prototype.put;
    let writes = 0;
    prototype.put = async function (row) {
      if (row.payload.name === 'Rollback branch' && ++writes === 2) throw Error('Disk write failed');
      return original.call(this, row);
    };
    try {
      await expect(
        api.save('branches', { name: 'Rollback branch', isActive: true, businessType: 'retail' }),
      ).rejects.toThrow('Disk write failed');
    } finally {
      prototype.put = original;
    }
    expect(await database.collection('stores').list()).toHaveLength(0);
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  }, 'admin');
});
test('a failed scrap command leaves available stock unchanged', async () => {
  await fixture(async ({ api, database, put }) => {
    await put('scrap_inventory', { id: '5', productId: '10', name: 'Copper', remainingQty: 5, stock: 5 });
    const prototype = Object.getPrototypeOf(database.collection('sync_outbox'));
    const original = prototype.put;
    prototype.put = async function (row) {
      if (row.payload.table === 'scrap_sales') throw Error('Queue write failed');
      return original.call(this, row);
    };
    try {
      await expect(
        api.save('scrapSales', {
          partyId: '7',
          items: [{ productId: '10', name: 'Copper', quantity: 2, unitPrice: 10 }],
        }),
      ).rejects.toThrow('Queue write failed');
    } finally {
      prototype.put = original;
    }
    expect((await database.collection('scrap_inventory').list())[0].payload.remainingQty).toBe(5);
    expect(await database.collection('scrap_sales').list()).toHaveLength(0);
  });
});

test('malformed refresh responses preserve the last synced collection', async () => {
  await fixture(async ({ api, database, put, setResponse }) => {
    await put('transfers', { id: 'saved', status: 'PENDING' });
    setResponse(async () => ({ logisticsRecords: null }));
    await expect(api.refresh('transfers')).rejects.toThrow('invalid collection');
    expect((await database.collection('transfers').list())[0].payload.id).toBe('saved');
  });
});

const waybillDraft = {
  sellerName: 'Seller One',
  sellerAddress: 'Seller street',
  buyerName: 'Buyer One',
  buyerAddress: 'Buyer street',
  invoiceNumber: 'INV-1',
  items: [{ productId: '10', name: 'Cable', quantity: 2, unitPrice: 50, taxRate: 18 }],
  totalAmount: 118,
};
test('inline seller creation persists a supplier and the waybill waits for its replay', async () => {
  await fixture(async ({ api, context, database }) => {
    const contacts = createCustomersApi({
      getContext: context,
      createId: () => 'new-seller',
      mapCustomer: (value) => ({ ...value, id: String(value.id), type: String(value.type || 'SUPPLIER') }),
      request: async () => ({
        saveParty: { id: 71, name: 'Seller One', type: 'SUPPLIER', addressLine: 'Seller street' },
      }),
    });
    const saved = await contacts.create({
      type: 'SUPPLIER',
      name: 'Seller One',
      address: 'Seller street',
      details: { state: 'Tamil Nadu' },
    });
    expect((await database.collection('customers').list())[0].payload.type).toBe('SUPPLIER');
    const result = await api.save('waybills', { ...waybillDraft, ...sellerSnapshot(saved.record) });
    expect(result.record.details.sellerName).toBe('Seller One');
    expect(result.record.details.sellerState).toBe('Tamil Nadu');
    const jobs = await database.collection('sync_outbox').list();
    const command = jobs.find(
      (job) => job.payload.request?.command === 'NativeOperations.createLogistics.v1',
    );
    expect(command.payload.dependencyJobIds).toContain(
      jobs.find((job) => job.payload.table === 'customers').payload.offlineId,
    );
    await contacts.pushPending();
    let variables;
    await pushApiMutations({
      database,
      assertCurrent: () => {},
      request: async (_query, input) => {
        variables = input;
        return {
          createLogisticsRecord: {
            id: '81',
            referenceNumber: 'WB-81',
            status: 'DRAFT',
            details: input.input.details,
          },
        };
      },
    });
    expect(String(variables.input.details.sellerId)).toBe('71');
    expect(variables.input.details.sellerAddress).toBe('Seller street');
  });
});
test('shipping bills inherit seller snapshots and keep explicit seller edits', async () => {
  await fixture(async ({ api, put }) => {
    await put('logistics_records', {
      id: '1',
      referenceNumber: 'WB-1',
      status: 'DRAFT',
      details: { ...waybillDraft, sellerState: 'Tamil Nadu' },
    });
    const draft = {
      waybillId: '1',
      recipientName: 'Buyer One',
      destinationAddress: 'Buyer street',
      packageCount: 1,
    };
    const inherited = await api.save('shipping', draft);
    expect(inherited.record.details.sellerName).toBe('Seller One');
    expect(inherited.record.details.sellerAddress).toBe('Seller street');
    const edited = await api.save('shipping', {
      ...draft,
      sellerName: 'Different sender',
      sellerAddress: 'Warehouse',
    });
    expect(edited.record.details.sellerName).toBe('Different sender');
    expect(edited.record.details.sellerAddress).toBe('Warehouse');
  });
});
test('seller selection clears missing fields instead of retaining a previous contact', () => {
  expect(sellerSnapshot({ id: '2', name: 'New seller' })).toMatchObject({
    sellerId: '2',
    sellerAddress: '',
    sellerGstin: '',
    sellerPhone: '',
    sellerEmail: '',
    sellerState: '',
  });
  expect(waybillSeller({ sellerName: 'Sender', buyerName: 'Buyer' })).toMatchObject({
    sellerName: 'Sender',
    sellerAddress: '',
  });
  expect(validateOperation('waybills', { ...waybillDraft, sellerPhone: '12345' }).sellerPhone).toBeDefined();
});

test('single-branch businesses cannot queue transfer writes or status changes', async () => {
  await fixture(async ({ context, database, put }) => {
    const api = createOperationsApi({
      getContext: () => ({ ...context(), branchIds: ['1'] }),
      request: async () => {
        throw new Error('Unexpected network request');
      },
    });
    await expect(api.save('transfers', transfer)).rejects.toThrow('at least two branches');
    const row = await put('transfers', { id: 'old', status: 'PENDING' });
    await expect(api.transition('transfers', row, 'APPROVED')).rejects.toThrow('at least two branches');
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  });
});
