import { expect, test } from 'bun:test';
import { allocatePurchaseSplits } from '../../../src/features/purchases/domain';

test('purchase item splits preserve quantity and allocate source cost', () => {
  expect(
    allocatePurchaseSplits(10, 500, [
      { targetProductName: 'Pack A', quantity: 4, unit: 'pcs' },
      { targetProductName: 'Pack B', quantity: 6, unit: 'pcs' },
    ]),
  ).toEqual([
    { targetProductName: 'Pack A', quantity: 4, unit: 'pcs', allocatedCost: 200, costPerUnit: 50 },
    { targetProductName: 'Pack B', quantity: 6, unit: 'pcs', allocatedCost: 300, costPerUnit: 50 },
  ]);
});

test('purchase item splits reject mismatched quantities', () => {
  expect(() =>
    allocatePurchaseSplits(10, 500, [{ targetProductName: 'Pack A', quantity: 4, unit: 'pcs' }]),
  ).toThrow('exactly match');
});
