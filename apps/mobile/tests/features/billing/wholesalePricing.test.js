import { expect, test } from 'bun:test';
import { resolveWholesaleTier, wholesaleTiers } from '../../../src/features/billing/domain/wholesalePricing';

const product = {
  id: '1',
  name: 'Case',
  category: 'Stock',
  price: 100,
  stock: 200,
  emoji: '📦',
  color: '#fff',
  details: {
    wholesaleTierPrices: [
      { minimumQuantity: 50, price: 82 },
      { minimumQuantity: 10, price: 95 },
    ],
  },
};

test('normalizes server-configured wholesale tiers and retains the base price', () => {
  expect(wholesaleTiers(product)).toEqual([
    { minimumQuantity: 1, price: 100 },
    { minimumQuantity: 10, price: 95 },
    { minimumQuantity: 50, price: 82 },
  ]);
});

test('selects the highest qualifying tier without fabricating discounts', () => {
  expect(resolveWholesaleTier(product, 9).price).toBe(100);
  expect(resolveWholesaleTier(product, 10).price).toBe(95);
  expect(resolveWholesaleTier(product, 80).price).toBe(82);
});
