import { expect, test } from 'bun:test';
import {
  sendBarcodeBatch,
  validateBarcodeBatch,
} from '../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/barcodeBatch';
import { reconciliationLabels } from '../../../../vendor/pos-ui-shared/packages-native/feature-inventory/src/reconciliationLabels';
const product = { id: 'p', name: 'Item', barcode: '12345', price: 10 };
test('multi-item label counts split into bounded audited chunks without losing quantities', async () => {
  const calls = [];
  const result = await sendBarcodeBatch(
    [
      { product, quantity: 45 },
      { product: { ...product, id: 'p2', barcode: 'ABC' }, quantity: 2 },
    ],
    { currency: 'INR', send: async (document, copies) => calls.push({ barcode: document.barcode, copies }) },
  );
  expect(calls).toEqual([
    { barcode: '12345', copies: 20 },
    { barcode: '12345', copies: 20 },
    { barcode: '12345', copies: 5 },
    { barcode: 'ABC', copies: 2 },
  ]);
  expect(result).toEqual({ sent: 47, stopped: false });
});
test('invalid quantities and missing barcodes cannot start physical printing', async () => {
  for (const item of [
    { product, quantity: 0 },
    { product, quantity: 1.5 },
    { product: { ...product, barcode: '' }, quantity: 1 },
  ]) {
    expect(validateBarcodeBatch([item])).toBeDefined();
    let calls = 0;
    await expect(
      sendBarcodeBatch([item], {
        currency: 'INR',
        send: async () => {
          calls++;
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  }
});
test('an uncertain chunk is never retried and a stop request ends between chunks', async () => {
  let calls = 0;
  await expect(
    sendBarcodeBatch([{ product, quantity: 50 }], {
      currency: 'INR',
      send: async () => {
        if (++calls === 2) throw new Error('Uncertain output');
      },
    }),
  ).rejects.toThrow('Uncertain');
  expect(calls).toBe(2);
  let stopped = false;
  const result = await sendBarcodeBatch([{ product, quantity: 50 }], {
    currency: 'INR',
    send: async () => {
      stopped = true;
    },
    shouldStop: () => stopped,
  });
  expect(result).toEqual({ sent: 20, stopped: true });
});
test('reconciliation suggests labels for positive additions only and keeps fractional counts explicit', () => {
  const products = [
    product,
    { ...product, id: 'fraction' },
    { ...product, id: 'missing', barcode: undefined },
  ];
  const suggestions = reconciliationLabels(
    {
      lines: [
        { productId: 'p', productName: 'Item', previousQuantity: 5, countedQuantity: 12 },
        { productId: 'p', productName: 'Item', previousQuantity: 8, countedQuantity: 3 },
        { productId: 'fraction', productName: 'Weight', previousQuantity: 1, countedQuantity: 2.5 },
        { productId: 'missing', productName: 'No barcode', previousQuantity: 0, countedQuantity: 3 },
      ],
    },
    products,
  );
  expect(suggestions.items.map((item) => [item.product.id, item.quantity, item.addedQuantity])).toEqual([
    ['p', 7, 7],
    ['fraction', 1, 1.5],
  ]);
  expect(suggestions.missing).toEqual(['No barcode']);
});
