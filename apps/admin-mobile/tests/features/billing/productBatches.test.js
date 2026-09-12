import { expect, test } from 'bun:test';
import {
    normalizeProductBatches,
    preferredProductBatch,
} from '../../../src/features/billing/domain/productBatches';

const product = (details) => ({
    id: '1',
    name: 'Medicine',
    category: 'General',
    price: 20,
    stock: 10,
    emoji: '💊',
    color: '#fff',
    details,
});

test('normalizes legacy single-batch product metadata without inventing values', () => {
    expect(normalizeProductBatches([product({ batchNumber: 'B-1', expiryDate: '2027-01-01' })])).toEqual([
        expect.objectContaining({
            productId: '1',
            batchNumber: 'B-1',
            expiryDate: '2027-01-01',
            stock: 10,
            price: 20,
        }),
    ]);
    expect(normalizeProductBatches([product({})])).toEqual([]);
});

test('selects FEFO stock while excluding expired and empty batches', () => {
    const batches = normalizeProductBatches([
        product({
            batches: [
                { id: 'late', batchNumber: 'L', expiryDate: '2027-06-01', stock: 5 },
                { id: 'soon', batchNumber: 'S', expiryDate: '2026-10-01', stock: 2 },
                { id: 'old', batchNumber: 'O', expiryDate: '2026-01-01', stock: 3 },
                { id: 'empty', batchNumber: 'E', expiryDate: '2026-09-20', stock: 0 },
            ],
        }),
    ]);
    expect(preferredProductBatch(batches, new Date('2026-09-11T00:00:00Z'))?.id).toBe('soon');
});
