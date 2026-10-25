import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createScopeKey } from '@indyzai/pos-database';
import { createTeamApi } from '@indyzai/feature-organization/team-api';
import { resolveTableMutation } from '@indyzai/pos-database/table-mutations';
import { createTableMutation } from '@indyzai/pos-database/table-mutations';
import { createCustomersApi } from '@indyzai/feature-customers';

async function withApi(work, loginFailure = false) {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `customers-outbox-${crypto.randomUUID()}`;
  const database = new IndexedDbLocalDatabase(
    { tenantId: 't', userId: 'u', role: 'cashier', storeIds: ['b'], deviceId: 'd' },
    name,
  );
  await database.initialize();
  let calls = [];
  let token = 'token';
  let response = async (query) =>
    query.includes('saveParty') ? { saveParty: { id: '42', name: 'Customer' } } : { parties: [] };
  const team = createTeamApi({
    getContext: () => ({ database, scope: createScopeKey(database.scope), tenant: 't', token }),
    request: async () => {
      throw new Error('Unexpected request');
    },
  });
  const api = createCustomersApi({
    queueEmployeeLogin: async (input, tx) => {
      const staff = await team.create(input, tx);
      if (loginFailure) throw new Error('Save interrupted');
      return staff;
    },
    getContext: () => ({ database, scope: createScopeKey(database.scope), tenant: 't', token }),
    createId: () => crypto.randomUUID(),
    mapCustomer: (row) => ({
      ...row,
      id: String(row.id),
      type: String(row.type ?? 'CUSTOMER').toUpperCase(),
    }),
    request: async (_token, _tenant, query, variables) => {
      calls.push({ query, variables });
      return response(query);
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
        token = 'new-session';
      },
    });
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
}

test('customer creation is local-only and its server ID resolves dependent sale input', async () => {
  await withApi(async ({ api, database, calls }) => {
    const customer = (await api.create({ name: ' Customer ', address: 'Main street' })).record;
    expect(calls).toHaveLength(0);
    const [job] = await database.collection('sync_outbox').list();
    expect(job.syncStatus).toBe('PENDING');
    const sale = await createTableMutation(
      database,
      { table: 'sales', entityType: 'SALE' },
      {
        operation: 'CREATE',
        localId: 'sale-1',
        payload: { input: { partyId: customer.id } },
        dependencies: [{ jobId: job.payload.offlineId }],
      },
    );
    await api.pushPending();
    expect(calls[0].variables.input).toEqual({
      clientMutationId: job.payload.idempotencyKey,
      name: 'Customer',
      type: 'CUSTOMER',
      addressLine: 'Main street',
      phone: undefined,
      email: undefined,
      gstin: undefined,
      creditLimit: undefined,
    });
    expect((await database.collection('sync_outbox').get(job.id)).syncStatus).toBe('SYNCED');
    expect((await database.collection('sync_outbox').get(sale.job.id)).payload.data.input.partyId).toBe('42');
    expect((await database.collection('customers').get(customer.id)).payload.pendingSync).toBe(false);
    await api.pushPending();
    expect(calls).toHaveLength(1);
  });
});

test('startup sync does not create mutations for cached server customers', async () => {
  await withApi(async ({ api, database, calls, setResponse }) => {
    setResponse(async () => ({ parties: [{ id: '42', name: 'Existing customer', type: 'CUSTOMER' }] }));
    await api.sync();
    const customers = database.collection('customers');
    const list = customers.list.bind(customers);
    // The older Android customers table has no sync_status column, so its
    // collection cannot apply a syncStatus query at the SQL layer.
    customers.list = (query) => list({ ...query, syncStatus: undefined });

    await api.pushPending();

    expect(calls.filter(({ query }) => query.includes('saveParty'))).toHaveLength(0);
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  });
});

test('refresh keeps all party types in the local customers table without queuing creates', async () => {
  await withApi(async ({ api, database, calls, setResponse }) => {
    setResponse(async () => ({
      parties: [
        { id: '42', name: 'Customer', type: 'customer' },
        { id: '43', name: 'Supplier', type: 'supplier' },
      ],
    }));
    await api.sync();
    const rows = await database.collection('customers').list();
    expect(rows.map((row) => row.payload.type).sort()).toEqual(['CUSTOMER', 'SUPPLIER']);
    expect(calls[0].variables).toEqual({ skip: 0, take: 200 });
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  });
});

test('network failure retains a retryable customer mutation and refresh preserves it', async () => {
  await withApi(async ({ api, database, setResponse }) => {
    const customer = (await api.create({ name: 'Customer' })).record;
    setResponse(async () => {
      throw new Error('Offline');
    });
    await expect(api.pushPending()).rejects.toThrow('Offline');
    expect((await database.collection('sync_outbox').list())[0].syncStatus).toBe('PENDING');
    setResponse(async () => ({ parties: [] }));
    await api.sync();
    expect((await database.collection('customers').get(customer.id)).payload.name).toBe('Customer');
  });
});

test('a late customer response cannot be applied after a session switch', async () => {
  await withApi(async ({ api, database, setResponse, switchSession }) => {
    const customer = (await api.create({ name: 'Customer' })).record;
    setResponse(async () => {
      switchSession();
      return { saveParty: { id: '42', name: 'Customer' } };
    });
    await expect(api.pushPending()).rejects.toThrow('workspace changed');
    expect((await database.collection('customers').get(customer.id)).remoteId).toBeNull();
  });
});

test('stops retrying and marks job as FAILED after 3 failed attempts', async () => {
  await withApi(async ({ api, database, setResponse, calls }) => {
    await api.create({ name: 'Customer' });
    setResponse(async () => {
      throw new Error('Server error');
    });
    // 1st failure
    await expect(api.pushPending()).rejects.toThrow('Server error');
    let job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('PENDING');
    expect(job.payload.attempts).toBe(1);

    // 2nd failure
    await expect(api.pushPending()).rejects.toThrow('Server error');
    job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('PENDING');
    expect(job.payload.attempts).toBe(2);

    // 3rd failure: marks as FAILED
    await expect(api.pushPending()).rejects.toThrow('Server error');
    job = (await database.collection('sync_outbox').list())[0];
    expect(job.syncStatus).toBe('FAILED');
    expect(job.payload.attempts).toBe(3);
    expect(job.payload.errorMessage).toBe('Server error');

    // Subsequent pushPending skips this job and does not throw or call API
    const callCountBefore = calls.length;
    await api.pushPending();
    expect(calls.length).toBe(callCountBefore);
  });
});

for (const type of ['SUPPLIER', 'EMPLOYEE', 'TECHNICIAN', 'SCRAP_VENDOR']) {
  test(`contact creation preserves ${type} through the outbox and server acknowledgement`, async () => {
    await withApi(async ({ api, database, calls }) => {
      const contact = (await api.create({ name: ' Contact ', type })).record;
      expect(contact.type).toBe(type);
      expect((await database.collection('sync_outbox').list())[0].payload.data.type).toBe(type);
      await api.pushPending();
      expect(calls[0].variables.input.type).toBe(type);
      expect((await database.collection('customers').get(contact.id)).payload.type).toBe(type);
    });
  });
}

test('all contact fields can be edited offline before creation synchronizes', async () => {
  await withApi(async ({ api, database }) => {
    const original = (await api.create({ name: 'Supplier', type: 'SUPPLIER', discountPercent: 15 })).record;
    const edited = await api.update(original, {
      name: 'Updated',
      email: 'other@external.com',
      phone: '1234567890',
      address: 'New address',
      discountPercent: 30,
    });
    expect(edited.record).toMatchObject({
      name: 'Updated',
      email: 'other@external.com',
      address: 'New address',
    });
    expect(edited.record.discountPercent).toBeUndefined();
    const jobs = await database.collection('sync_outbox').list();
    expect(jobs.find((row) => row.payload.operation === 'UPDATE').payload.dependencyJobIds).toContain(
      jobs.find((row) => row.payload.operation === 'CREATE').payload.offlineId,
    );
    await expect(api.update(edited.record, 20)).rejects.toThrow('only available for customers');
  });
});
test('employee login and contact queue atomically with a resolvable staff dependency', async () => {
  await withApi(async ({ api, database, calls }) => {
    const created = await api.create(
      { name: 'Employee', type: 'EMPLOYEE', email: 'person@external.com' },
      { pin: '1234', role: 'cashier' },
    );
    const jobs = await database.collection('sync_outbox').list();
    const staff = jobs.find((row) => row.payload.table === 'users');
    const contact = jobs.find((row) => row.payload.table === 'customers');
    expect(contact.payload.dependencyJobIds).toContain(staff.payload.offlineId);
    expect(created.record.details.staffUserId).toBe(staff.payload.data.id);
    expect(JSON.stringify(created.record)).not.toContain('1234');
    await api.pushPending();
    expect(calls).toHaveLength(0);
    await resolveTableMutation(
      database,
      { table: 'users' },
      { jobId: staff.payload.offlineId, serverId: '101', payload: { ...staff.payload.data, id: '101' } },
    );
    expect((await database.collection('sync_outbox').get(contact.id)).payload.data.details.staffUserId).toBe(
      '101',
    );
    await api.pushPending();
    expect(calls[0].variables.input.details.staffUserId).toBe('101');
  });
});
test('a failed combined save rolls back both employee and login records', async () => {
  await withApi(async ({ api, database }) => {
    await expect(
      api.create(
        { name: 'Employee', type: 'EMPLOYEE', phone: '1234567890' },
        { pin: '1234', role: 'cashier' },
      ),
    ).rejects.toThrow('Save interrupted');
    for (const table of ['customers', 'users', 'sync_outbox', 'sync_dependencies'])
      expect(await database.collection(table).list()).toHaveLength(0);
  }, true);
});

test('editing a pending contact uses its resolved numeric server ID and clears removed details', async () => {
  await withApi(async ({ api, calls, setResponse }) => {
    const original = (await api.create({ name: 'Customer', email: 'old@example.com' })).record;
    await api.update(original, { name: 'Changed', email: undefined });
    setResponse(async (query) =>
      query.includes('updateParty')
        ? { updateParty: { id: '42', name: 'Changed', type: 'CUSTOMER' } }
        : { saveParty: { id: '42', name: 'Customer', type: 'CUSTOMER' } },
    );
    await api.pushPending();
    await api.pushPending();
    expect(calls).toHaveLength(2);
    expect(calls[1].variables.id).toBe(42);
    expect(calls[1].variables.input.name).toBe('Changed');
    expect(calls[1].variables.input.email).toBe('');
  });
});

test('invalid contact data never enters the local database or sync queue', async () => {
  await withApi(async ({ api, database }) => {
    for (const type of ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'TECHNICIAN', 'SCRAP_VENDOR']) {
      await expect(api.create({ name: 'Person', type, phone: '12345' })).rejects.toThrow('7 to 15 digits');
    }
    expect(await database.collection('customers').list()).toHaveLength(0);
    expect(await database.collection('sync_outbox').list()).toHaveLength(0);
  });
});

test('invalid edits preserve the saved contact and do not add a mutation', async () => {
  await withApi(async ({ api, database }) => {
    const original = (await api.create({ name: 'Employee', type: 'EMPLOYEE', phone: '9876543210' })).record;
    await expect(api.update(original, { phone: '12345' })).rejects.toThrow('7 to 15 digits');
    expect((await database.collection('customers').get(original.id)).payload.phone).toBe('9876543210');
    expect(await database.collection('sync_outbox').list()).toHaveLength(1);
  });
});

test('dues collection is queued locally and cannot overpay or settle a non-account contact', async () => {
  await withApi(async ({ api, database, calls }) => {
    const contact = (await api.create({ name: 'Customer', type: 'CUSTOMER', balance: 100 })).record;
    await api.settleBalance(contact, 30);
    expect((await database.collection('customers').get(contact.id)).payload.balance).toBe(70);
    const jobs = await database.collection('sync_outbox').list();
    expect(jobs).toHaveLength(2);
    expect(
      jobs.find((job) => job.payload.entityType === 'API_MUTATION').payload.request.variables.amount,
    ).toBe(-30);
    expect(calls).toHaveLength(0);
    await expect(api.settleBalance(contact, 80)).rejects.toThrow('outstanding balance');
    await expect(api.settleBalance({ ...contact, type: 'EMPLOYEE' }, 1)).rejects.toThrow(
      'customer and supplier',
    );
    expect(await database.collection('sync_outbox').list()).toHaveLength(2);
  });
});
