import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createTableMutation, resolveTableMutation } from '@indyzai/pos-database/table-mutations';

test('settings saves retain newer offline edits when an earlier save is acknowledged', async () => {
    await withDatabase(async (database) => {
        const config = { table: 'app_settings', entityType: 'SETTINGS' };
        const first = await createTableMutation(database, config, {
            localId: 'business-settings',
            operation: 'UPDATE',
            payload: { values: { businessName: 'Shop' }, patch: { businessName: 'Shop' } },
        });
        const second = await createTableMutation(database, config, {
            localId: 'business-settings',
            operation: 'UPDATE',
            payload: { values: { businessName: 'Shop', currency: 'INR' }, patch: { currency: 'INR' } },
        });
        expect(second.job.payload.dependencyJobIds).toContain(first.job.payload.offlineId);
        await resolveTableMutation(database, config, {
            jobId: first.job.payload.offlineId,
            serverId: 'business-settings',
        });
        const row = await database.collection('app_settings').get('business-settings');
        expect(row.payload.values.currency).toBe('INR');
        expect(row.syncStatus).toBe('PENDING');
        expect((await database.collection('sync_outbox').get(second.job.id)).syncStatus).toBe('PENDING');
        await resolveTableMutation(database, config, {
            jobId: second.job.payload.offlineId,
            serverId: 'business-settings',
        });
        expect((await database.collection('app_settings').get('business-settings')).syncStatus).toBe(
            'SYNCED',
        );
    });
});

async function withDatabase(work) {
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    const name = `table-mutations-${crypto.randomUUID()}`;
    const database = new IndexedDbLocalDatabase(
        { tenantId: 't', userId: 'u', role: 'cashier', storeIds: ['b'], deviceId: 'device' },
        name,
    );
    await database.initialize();
    try {
        await work(database);
    } finally {
        await database.close();
        await Dexie.delete(name);
    }
}

test('resolving a customer rewrites the dependent bill and its durable outbox input', async () => {
    await withDatabase(async (database) => {
        const customer = await createTableMutation(
            database,
            { table: 'customers', entityType: 'CUSTOMER' },
            {
                localId: 'local-customer',
                operation: 'CREATE',
                payload: { name: 'Customer' },
            },
        );
        const sale = await createTableMutation(
            database,
            { table: 'sales', entityType: 'SALE' },
            {
                localId: 'local-sale',
                operation: 'CREATE',
                payload: { input: { partyId: 'local-customer' } },
                dependencies: [{ jobId: customer.job.payload.offlineId }],
            },
        );
        await resolveTableMutation(
            database,
            { table: 'customers' },
            {
                jobId: customer.job.payload.offlineId,
                serverId: '42',
                serverVersion: 1,
            },
        );
        const customerRow = await database.collection('customers').get('local-customer');
        const saleRow = await database.collection('sales').get('local-sale');
        const saleJob = await database.collection('sync_outbox').get(sale.job.id);
        expect(customerRow.remoteId).toBe('42');
        expect(customerRow.syncStatus).toBe('SYNCED');
        expect(saleRow.payload.input.partyId).toBe('42');
        expect(saleJob.payload.data.input.partyId).toBe('42');
        expect(saleJob.syncStatus).toBe('PENDING');
    });
});

test('a failed outbox write rolls back the local entity', async () => {
    await withDatabase(async (database) => {
        const outbox = database.collection('sync_outbox');
        const put = outbox.put;
        outbox.put = async () => {
            throw new Error('Storage unavailable');
        };
        try {
            await expect(
                createTableMutation(
                    database,
                    { table: 'customers' },
                    {
                        localId: 'customer1',
                        operation: 'CREATE',
                        payload: { name: 'Customer' },
                    },
                ),
            ).rejects.toThrow('Storage unavailable');
            expect(await database.collection('customers').get('customer1')).toBeUndefined();
            expect(await database.collection('sync_outbox').list()).toHaveLength(0);
        } finally {
            outbox.put = put;
        }
    });
});

test('an older acknowledgement preserves a newer local edit and chains its dependency', async () => {
    await withDatabase(async (database) => {
        const config = { table: 'customers', entityType: 'CUSTOMER' };
        const first = await createTableMutation(database, config, {
            localId: 'customer',
            operation: 'CREATE',
            payload: { name: 'Original' },
        });
        const second = await createTableMutation(database, config, {
            localId: 'customer',
            operation: 'UPDATE',
            payload: { name: 'Updated' },
        });
        expect(second.job.payload.dependencyJobIds).toContain(first.job.payload.offlineId);
        expect(second.job.payload.idempotencyKey).not.toBe(first.job.payload.idempotencyKey);
        await resolveTableMutation(database, config, {
            jobId: first.job.payload.offlineId,
            serverId: '42',
            payload: { name: 'Original' },
        });
        const record = await database.collection('customers').get('customer');
        expect(record.remoteId).toBe('42');
        expect(record.payload).toMatchObject({ id: '42', name: 'Updated' });
        expect(record.syncStatus).toBe('PENDING');
        const next = await database.collection('sync_outbox').get(second.job.id);
        expect(next.payload.data).toMatchObject({ id: '42', name: 'Updated' });
        await resolveTableMutation(database, config, {
            jobId: second.job.payload.offlineId,
            serverId: '42',
            payload: { name: 'Updated' },
        });
        expect((await database.collection('customers').get('customer')).syncStatus).toBe('SYNCED');
    });
});
