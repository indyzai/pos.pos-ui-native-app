import { expect, test } from 'bun:test';
import { inventoryPricing } from '@indyzai/feature-inventory/inventoryPricing';
import { purchasePricing } from '@indyzai/feature-purchase/purchasePricing';

test('simple MRP remains optional and does not manufacture stock levels', () => {
  const simple = inventoryPricing({ price: '90.50', costPrice: '60', mrp: '100', stock: '2.5' });
  expect(simple).toMatchObject({ price: 90.5, mrp: 100, stock: 2.5 });
  expect(simple.batches).toBeUndefined();
  expect(inventoryPricing({ price: '0', mrp: '', stock: '0' }).mrp).toBeUndefined();
  for (const mrp of ['-1', 'bad', 'Infinity'])
    expect(() => inventoryPricing({ price: '10', mrp, stock: '1' })).toThrow('MRP');
  expect(() => inventoryPricing({ price: '', stock: '1' })).toThrow('selling price');
});
test('editing a single stock level uses the visible sale price and preserves its identity', () => {
  const result = inventoryPricing({
    price: '95',
    costPrice: '70',
    mrp: '110',
    stock: '4',
    batches: [
      {
        id: 'batch-1',
        batchNumber: 'Original',
        expiryDate: '2028-01-01',
        mrp: 100,
        price: 90,
        costPrice: 60,
        stock: 2,
      },
    ],
  });
  expect(result.batches).toEqual([
    {
      id: 'batch-1',
      batchNumber: 'Original',
      expiryDate: '2028-01-01',
      mrp: 110,
      price: 95,
      costPrice: 70,
      stock: 4,
    },
  ]);
});
test('multiple levels retain separate prices and compute combined stock', () => {
  const result = inventoryPricing({
    price: '90',
    stock: '0',
    batches: [
      { id: 'a', batchNumber: 'a', mrp: '100', price: '90', stock: '2' },
      { id: 'b', batchNumber: 'b', mrp: '120', price: '110', stock: '3' },
    ],
  });
  expect(result.stock).toBe(5);
  expect(result.batches.map((row) => row.price)).toEqual([90, 110]);
  expect(() =>
    inventoryPricing({
      price: '90',
      stock: '1.5',
      mrp: '100',
      batches: [{ id: 'a', batchNumber: 'a', stock: 1.5 }],
    }),
  ).toThrow('whole-number');
});
test('purchase defaults resolve only a configured stock MRP and explain ambiguous stock', () => {
  const line = { productName: 'Tea', quantity: 2, purchasePrice: 60, taxRate: 0 };
  expect(purchasePricing(line, { details: { mrp: 100 } })).toEqual(line);
  expect(purchasePricing(line, { details: { batches: [{ mrp: 100 }, { mrp: 100 }] } }).mrp).toBe(100);
  const product = { details: { batches: [{ mrp: 100 }, { mrp: 120 }] } };
  expect(() => purchasePricing(line, product)).toThrow('Enter MRP for Tea');
  expect(purchasePricing({ ...line, mrp: 120 }, product).mrp).toBe(120);
  expect(() => purchasePricing({ ...line, mrp: 120, quantity: 0.5 }, product)).toThrow('whole-number');
});
