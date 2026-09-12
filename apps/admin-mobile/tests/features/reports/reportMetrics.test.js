import { expect, test } from 'bun:test';
import { buildReportMetrics } from '../../../src/features/reports/reportMetrics';

test('report metrics filter the period and calculate net sales', () => {
    const orders = [
        {
            id: '1',
            billId: 'INV-1',
            subtotal: 90,
            taxAmount: 10,
            discountAmount: 0,
            totalAmount: 100,
            status: 'COMPLETED',
            type: 'SALE',
            saleDate: '2026-09-12T10:00:00.000Z',
            paymentMethod: 'Cash',
            items: [
                {
                    productId: 'p1',
                    name: 'Tea',
                    quantity: 2,
                    unitPrice: 50,
                    discountAmount: 0,
                    taxAmount: 10,
                    lineTotal: 100,
                },
            ],
        },
        {
            id: 'old',
            billId: 'INV-OLD',
            subtotal: 500,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 500,
            status: 'COMPLETED',
            type: 'SALE',
            saleDate: '2026-07-01T10:00:00.000Z',
            paymentMethod: 'Card',
            items: [],
        },
    ];
    const refunds = [
        {
            id: 'r1',
            offlineId: 'r1',
            creditNoteNumber: 'CN-1',
            originalSaleId: '1',
            items: [],
            subtotal: 20,
            tax: 0,
            total: 20,
            refundMethod: 'Cash',
            status: 'COMPLETED',
            createdAt: '2026-09-13T10:00:00.000Z',
        },
    ];

    const metrics = buildReportMetrics(orders, refunds, 7, new Date('2026-09-13T12:00:00.000Z'));

    expect(metrics.orderCount).toBe(1);
    expect(metrics.grossRevenue).toBe(100);
    expect(metrics.refundTotal).toBe(20);
    expect(metrics.netRevenue).toBe(80);
    expect(metrics.taxTotal).toBe(10);
    expect(metrics.payments).toEqual([{ name: 'Cash', amount: 100 }]);
    expect(metrics.products[0]).toEqual({ name: 'Tea', quantity: 2, revenue: 100 });
});
