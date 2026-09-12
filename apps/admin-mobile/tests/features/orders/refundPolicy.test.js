import { expect, test } from 'bun:test';
import { buildPendingRefund, refundableQuantity } from '../../../src/features/orders/refundPolicy';

const order = {
    id: '10',
    billId: 'INV-10',
    subtotal: 200,
    taxAmount: 20,
    discountAmount: 0,
    totalAmount: 220,
    status: 'COMPLETED',
    type: 'SALE',
    saleDate: '2026-09-11',
    items: [
        {
            productId: '1',
            name: 'Item',
            quantity: 2,
            unitPrice: 100,
            discountAmount: 0,
            taxAmount: 20,
            lineTotal: 200,
        },
    ],
};

test('builds a proportional, idempotent pending refund', () => {
    const refund = buildPendingRefund(
        order,
        [{ productId: '1', quantity: 1 }],
        [],
        'Damaged',
        'cash',
        'abcdef-1',
        '2026-09-11T00:00:00Z',
    );
    expect(refund).toMatchObject({
        creditNoteNumber: 'CN-20260911-ABCDEF',
        subtotal: 100,
        tax: 10,
        total: 110,
        status: 'PENDING_SYNC',
    });
});

test('prevents refunding more than the unrefunded sold quantity', () => {
    const prior = buildPendingRefund(
        order,
        [{ productId: '1', quantity: 1 }],
        [],
        '',
        'cash',
        'prior-1',
        '2026-09-11T00:00:00Z',
    );
    expect(refundableQuantity(order, '1', [prior])).toBe(1);
    expect(() =>
        buildPendingRefund(
            order,
            [{ productId: '1', quantity: 2 }],
            [prior],
            '',
            'cash',
            'next-1',
            '2026-09-11T00:00:00Z',
        ),
    ).toThrow('valid refundable');
});
