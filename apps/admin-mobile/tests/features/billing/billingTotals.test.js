import { expect, test } from 'bun:test';
import { calculateBillingTotals } from '../../../src/features/billing/domain/billingTotals';

const items = [
    {
        id: '1',
        name: 'Item',
        category: 'General',
        price: 118,
        stock: 5,
        emoji: '📦',
        color: '#fff',
        quantity: 1,
        taxRate: 18,
    },
];

test('inclusive tax is extracted without increasing the displayed total', () => {
    expect(calculateBillingTotals(items, { taxCalculation: 'inclusive', roundOffTotal: false })).toEqual({
        subtotal: 118,
        discount: 0,
        tax: 18,
        total: 118,
        rounding: 0,
    });
});

test('exclusive tax is added and optional rounding is reported', () => {
    expect(calculateBillingTotals(items, { taxCalculation: 'exclusive', roundOffTotal: true })).toEqual({
        subtotal: 118,
        discount: 0,
        tax: 21.24,
        total: 139,
        rounding: -0.24,
    });
});

test('item and order discounts reduce taxable value without exceeding subtotal', () => {
    expect(
        calculateBillingTotals(
            [{ ...items[0], discount: 18 }],
            { taxCalculation: 'inclusive', roundOffTotal: false },
            10,
        ),
    ).toEqual({ subtotal: 118, discount: 28, tax: 13.73, total: 90, rounding: 0 });
});
