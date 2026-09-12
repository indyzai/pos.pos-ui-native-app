import { expect, test } from 'bun:test';
import { canManageScrap } from '../../../src/features/scrap/permissions';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '../../../src/features/scrap/scrapSync';

test('matches the scrap API role guard', () => {
    expect(canManageScrap('owner')).toBe(true);
    expect(canManageScrap('MANAGER')).toBe(true);
    expect(canManageScrap('cashier')).toBe(false);
});

test('builds a draft scrap purchase linked by its client bill id', () => {
    const job = scrapPurchaseJob(
        {
            id: 'SCRAP-offline-1',
            total: 120,
            items: [{ productId: '7', productName: 'Old battery', quantity: 2, unitPrice: 60 }],
        },
        { id: '11', counterId: '2', branchId: '3', status: 'OPEN' },
        { id: '5', name: 'Customer' },
    );
    expect(job.payload).toEqual(
        expect.objectContaining({
            billId: 'SCRAP-offline-1',
            partyId: 5,
            branchId: 3,
            counterId: 2,
            counterSessionId: 11,
            status: 'DRAFT',
            totalAmount: 120,
        }),
    );
});

test('retains failed scrap purchases so the linked sale cannot sync first', async () => {
    const jobs = [{ id: 'SCRAP-1', payload: {}, status: 'PENDING', createdAt: 'now' }];
    await expect(
        syncScrapPurchaseJobs(
            jobs,
            async () => {
                throw new Error('Offline');
            },
            async () => {},
        ),
    ).rejects.toThrow('Offline');
    expect(jobs).toEqual([expect.objectContaining({ status: 'FAILED', error: 'Offline' })]);
});
