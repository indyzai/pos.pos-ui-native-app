import type { Product } from '../types/billing';

export type WholesaleTier = { minimumQuantity: number; price: number };

export function wholesaleTiers(product: Product): WholesaleTier[] {
  const valid = (product.details?.wholesaleTierPrices || []).filter(
    (tier) =>
      Number.isInteger(tier.minimumQuantity) &&
      tier.minimumQuantity > 0 &&
      Number.isFinite(tier.price) &&
      tier.price >= 0,
  );
  const byQuantity = new Map<number, number>([[1, product.price]]);
  for (const tier of valid) byQuantity.set(tier.minimumQuantity, tier.price);
  return [...byQuantity.entries()]
    .map(([minimumQuantity, price]) => ({ minimumQuantity, price }))
    .sort((left, right) => left.minimumQuantity - right.minimumQuantity);
}

export function resolveWholesaleTier(product: Product, quantity: number): WholesaleTier {
  return wholesaleTiers(product).reduce(
    (selected, tier) => (quantity >= tier.minimumQuantity ? tier : selected),
    { minimumQuantity: 1, price: product.price },
  );
}
