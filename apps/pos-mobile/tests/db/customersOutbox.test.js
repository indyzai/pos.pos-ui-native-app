import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createTableMutation } from '@indyzai/pos-database/table-mutations';
import { createCustomersApi } from '@indyzai/feature-customers';

async function withApi(work) {
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
    const api = createCustomersApi({
        getContext: () => ({ database, scope: 'test-scope', tenant: 't', token }),
        createId: () => crypto.randomUUID(),
        mapCustomer: (row) => ({ ...row, id: String(row.id), type: 'CUSTOMER' }),
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
        const customer = await api.create({ name: ' Customer ', address: 'Main street' });
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
        expect((await database.collection('sync_outbox').get(sale.job.id)).payload.data.input.partyId).toBe(
            '42',
        );
        expect((await database.collection('customers').get(customer.id)).payload.pendingSync).toBe(false);
        await api.pushPending();
        expect(calls).toHaveLength(1);
    });
});

test('network failure retains a retryable customer mutation and refresh preserves it', async () => {
    await withApi(async ({ api, database, setResponse }) => {
        const customer = await api.create({ name: 'Customer' });
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
        const customer = await api.create({ name: 'Customer' });
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

