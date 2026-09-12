import { expect, test } from 'bun:test';
import { canManageWaybills } from '../../../src/features/logistics/permissions';
import { syncWaybillJobs, waybillJobFromSale } from '../../../src/features/logistics/waybillSync';

test('only roles accepted by the logistics API auto-create waybills', () => {
    expect(canManageWaybills('owner')).toBe(true);
    expect(canManageWaybills('MANAGER')).toBe(true);
    expect(canManageWaybills('cashier')).toBe(false);
});

test('creates a deterministic waybill job after the server bill is known', () => {
    const job = waybillJobFromSale(
        {
            id: 'offline-1',
            operation: 'CREATE',
            payload: {},
            createdAt: '2026-09-11T00:00:00Z',
            receiptNumber: 'LOCAL-1',
            input: { details: { waybillDraft: { buyerName: 'Buyer', branchId: '3' } } },
        },
        { id: '99', billId: 'INV-99' },
    );
    expect(job).toMatchObject({
        id: 'offline-1',
        payload: {
            type: 'WAYBILL',
            referenceNumber: 'WB-INV-99',
            fromBranchId: '3',
            details: { invoiceId: '99', invoiceNumber: 'INV-99', buyerName: 'Buyer' },
        },
    });
});

test('retains a failed waybill job for retry', async () => {
    const jobs = [{ id: '1', saleOfflineId: '1', payload: {}, status: 'PENDING', createdAt: 'now' }];
    let persisted = 0;
    await expect(
        syncWaybillJobs(
            jobs,
            async () => {
                throw new Error('Offline');
            },
            async () => {
                persisted++;
            },
        ),
    ).rejects.toThrow('Offline');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ status: 'FAILED', error: 'Offline' });
    expect(persisted).toBe(1);
});
