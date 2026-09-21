import { expect, test } from 'bun:test';
import { calculateBillingTotals } from '../../../src/features/billing/domain/billingTotals';

test('configured line tax overrides are reflected in exclusive totals', () => {
  const item = {
    id: '1',
    name: 'Item',
    category: 'General',
    price: 100,
    quantity: 1,
    stock: 2,
    emoji: '',
    color: '',
    taxRate: 12,
  };
  expect(calculateBillingTotals([item], { taxCalculation: 'exclusive', roundOffTotal: false })).toMatchObject(
    { tax: 12, total: 112 },
  );
});
