import { expect, test } from 'bun:test';
import {
  createReconciliationVariables,
  createReconciliationReportVariables,
  createStockReconciliationRecord,
} from '../../../src/features/inventory/reconciliation';

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

test('stock reconciliation submits multiple products in one API payload', () => {
  expect(
    createReconciliationReportVariables(
      {
        items: [
          { productId: 'product-1', countedQuantity: 12 },
          { productId: 'product-2', countedQuantity: 4 },
        ],
        reference: 'COUNT-002',
      },
      123456,
    ),
  ).toEqual({
    input: {
      items: [
        { productId: 'product-1', countedQuantity: 12 },
        { productId: 'product-2', countedQuantity: 4 },
      ],
      reconciliationDate: 123456,
      reference: 'COUNT-002',
      remarks: undefined,
    },
  });
});

test('stock reconciliation history records variance and inventory loss', () => {
  const record = createStockReconciliationRecord(
    { id: '42', name: 'Tea', category: 'Drinks', price: 25, stock: 10, emoji: '', color: '' },
    { productId: '42', countedQuantity: 7, remarks: 'Damaged' },
    'COMPLETED',
    Date.parse('2026-09-14T10:00:00.000Z'),
  );
  expect(record).toMatchObject({
    previousQuantity: 10,
    countedQuantity: 7,
    variance: -3,
    lossQuantity: 3,
    lossValue: 75,
    status: 'COMPLETED',
  });
});
