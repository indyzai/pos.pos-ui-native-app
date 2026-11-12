globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test } from 'bun:test';
import { useBillingCart } from '../../../src/features/billing/hooks/useBillingCart';
import {
  billingBatchSelection,
  normalizeProductBatches,
} from '@indyzai/feature-billing/domain/productBatches';
import { createPendingSale } from '@indyzai/feature-billing/salesOutbox';

test('auto-selected legacy stock keeps its ID through cart additions and checkout', async () => {
  let cart;
  function Harness() {
    cart = useBillingCart({ taxCalculation: 'exclusive', roundOffTotal: false });
    return null;
  }
  const product = {
    id: '12',
    name: 'Old item',
    category: 'General',
    price: 10,
    stock: 3,
    emoji: '',
    color: '',
    details: {
      batches: [
        { id: 'empty', mrp: 12, stock: 0 },
        { id: 'actual-stock', mrp: 15, price: 14, stock: 3 },
      ],
    },
  };
  const batches = normalizeProductBatches([product]);
  let view;
  await act(async () => {
    view = create(<Harness />);
  });
  for (let count = 0; count < 3; count++) {
    const selected = billingBatchSelection(product, batches, cart.items, false);
    expect(selected.kind).toBe('automatic');
    await act(async () => cart.addItem(selected.product));
  }
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0]).toMatchObject({
    id: '12',
    quantity: 3,
    price: 14,
    customization: { metadata: { batchId: 'actual-stock' } },
  });
  expect(billingBatchSelection(product, batches, cart.items, false).kind).toBe('unavailable');
  const sale = createPendingSale({
    items: cart.items,
    payment: 'Cash',
    session: null,
    requireOpenSession: false,
  });
  expect(sale.input.items[0]).toMatchObject({
    productId: 12,
    stockBatchId: 'actual-stock',
    mrp: 15,
    quantity: 3,
    unitPrice: 14,
  });
  await act(async () => view.unmount());
});
