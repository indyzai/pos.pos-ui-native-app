import { expect, test } from 'bun:test';
import { createReconciliationVariables } from '../../../src/features/inventory/reconciliation';

test('stock reconciliation builds the production API payload', () => {
  expect(
    createReconciliationVariables(
      {
        productId: 'product-1',
        countedQuantity: 12,
        reference: 'COUNT-001',
        remarks: 'Shelf count',
      },
      123456,
    ),
  ).toEqual({
    input: {
      items: [{ productId: 'product-1', countedQuantity: 12 }],
      reconciliationDate: 123456,
      reference: 'COUNT-001',
      remarks: 'Shelf count',
    },
  });
});
