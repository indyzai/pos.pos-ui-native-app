import { expect, test } from 'bun:test';
import {
  normalizeProductBatches,
  preferredProductBatch,
} from '@indyzai/feature-billing/domain/productBatches';

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

test('legacy MRP rows without display labels retain their original stock IDs', () => {
  const batches = normalizeProductBatches([
    product({ batches: [{ id: 'legacy-stock', mrp: 30, price: 25, stock: 4 }] }),
  ]);
  expect(batches).toHaveLength(1);
  expect(batches[0]).toMatchObject({ id: 'legacy-stock', batchNumber: 'MRP 30', stock: 4 });
});

test('auto-selects the only usable price level and carries its ID into cart metadata', async () => {
  const { billingBatchSelection, priceLevelCustomization } = await import(
    '@indyzai/feature-billing/domain/productBatches'
  );
  const item = product({
    batches: [
      { id: 'old', mrp: 30, price: 25, stock: 0 },
      { id: 'active', mrp: 40, price: 35, stock: 3 },
    ],
  });
  const selection = billingBatchSelection(item, normalizeProductBatches([item]), [], false);
  expect(selection.kind).toBe('automatic');
  expect(selection.product).toMatchObject({
    id: '1',
    price: 35,
    stock: 3,
    details: { stockBatchId: 'active', mrp: 40 },
  });
  expect(priceLevelCustomization(selection.product).metadata.batchId).toBe('active');
});

test('only shows choices for multiple stocked price levels and blocks empty stock', async () => {
  const { billingBatchSelection } = await import('@indyzai/feature-billing/domain/productBatches');
  const item = product({
    batches: [
      { id: 'a', mrp: 30, price: 25, stock: 2 },
      { id: 'b', mrp: 40, price: 35, stock: 3 },
    ],
  });
  const batches = normalizeProductBatches([item]);
  expect(billingBatchSelection(item, batches, [], false).kind).toBe('choose');
  const reserved = [{ ...item, quantity: 2, customization: { key: 'a', metadata: { batchId: 'a' } } }];
  expect(billingBatchSelection(item, batches, reserved, false)).toMatchObject({
    kind: 'automatic',
    product: { details: { stockBatchId: 'b' } },
  });
  const allReserved = [...reserved, { ...item, quantity: 3, details: { stockBatchId: 'b' } }];
  expect(billingBatchSelection(item, batches, allReserved, false).kind).toBe('unavailable');
});

test('single legacy stock level may use total stock, but multiple levels cannot each claim that total', async () => {
  const { billingBatchSelection } = await import('@indyzai/feature-billing/domain/productBatches');
  const single = product({ batches: [{ id: 'one', mrp: 30 }] });
  const batches = normalizeProductBatches([single]);
  expect(billingBatchSelection(single, batches, [], false)).toMatchObject({
    kind: 'automatic',
    product: { stock: 10, details: { stockBatchId: 'one' } },
  });
  const multiple = product({
    batches: [
      { id: 'a', mrp: 30 },
      { id: 'b', mrp: 40 },
    ],
  });
  expect(normalizeProductBatches([multiple]).map((batch) => batch.stock)).toEqual([0, 0]);
  expect(billingBatchSelection(product({ mrp: 30 }), [], [], false).kind).toBe('standard');
});

test('automatic selection excludes expired stock when expiry checking is enabled', async () => {
  const { billingBatchSelection } = await import('@indyzai/feature-billing/domain/productBatches');
  const item = product({
    batches: [
      { id: 'expired', mrp: 30, expiryDate: '2000-01-01', stock: 3 },
      { id: 'fresh', mrp: 40, expiryDate: '2099-01-01', stock: 2 },
    ],
  });
  const batches = normalizeProductBatches([item]);
  expect(billingBatchSelection(item, batches, [], true)).toMatchObject({
    kind: 'automatic',
    product: { details: { stockBatchId: 'fresh' } },
  });
  expect(billingBatchSelection(item, batches, [], false).kind).toBe('choose');
});

test('legacy cached MRP stock is selected even when expiry tracking is disabled', async () => {
  const { billingProductBatches, billingBatchSelection } = await import(
    '@indyzai/feature-billing/domain/productBatches'
  );
  const old = product({ mrp: 40 });
  const cache = [
    { id: 'cached-stock', productId: old.id, batchNumber: 'Existing', mrp: 40, price: 35, stock: 2 },
  ];
  const batches = billingProductBatches(old, cache, false);
  expect(billingBatchSelection(old, batches, [], false)).toMatchObject({
    kind: 'automatic',
    product: { details: { stockBatchId: 'cached-stock' } },
  });
  expect(billingProductBatches({ ...old, id: 'another-product' }, cache, false)).toEqual([]);
});
