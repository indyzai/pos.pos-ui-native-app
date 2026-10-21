import {
  priceLevelCustomization,
  priceLevelLineCapacity,
} from '@indyzai/feature-billing/domain/productBatches';
import { customerDiscount } from '@indyzai/feature-billing/domain/customerPricing';
import { useMemo, useState } from 'react';
import type { CartCustomization, CartItem, Product } from '@indyzai/feature-billing/types/billing';
import {
  calculateBillingTotals,
  type BillingCalculationPolicy,
} from '@indyzai/feature-billing/domain/billingTotals';

export function useBillingCart(policy: BillingCalculationPolicy, customerPercent = 0) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [manualOrderDiscount, setOrderDiscountState] = useState<number | null>(null);
  const orderDiscount = manualOrderDiscount ?? customerDiscount(items, customerPercent);
  const addItem = (product: Product, quantity = 1, customization?: CartCustomization) =>
    setItems((current) => {
      const resolvedCustomization = priceLevelCustomization(product, customization);
      const lineId = resolvedCustomization ? `${product.id}:${resolvedCustomization.key}` : product.id;
      const existing = current.find((item) => (item.lineId || item.id) === lineId);
      const capacity = priceLevelLineCapacity(
        current,
        product.id,
        product.stock,
        String(resolvedCustomization?.metadata?.batchId || ''),
        lineId,
      );
      if (capacity <= 0 || (existing && existing.quantity >= capacity)) return current;
      const amount = Math.max(1, Math.floor(quantity));
      return existing
        ? current.map((item) =>
            (item.lineId || item.id) === lineId
              ? { ...item, quantity: Math.min(capacity, item.quantity + amount) }
              : item,
          )
        : [
            ...current,
            {
              ...product,
              price: product.price + (resolvedCustomization?.priceAdjustment || 0),
              quantity: Math.min(capacity, amount),
              discount: 0,
              lineId,
              customization: resolvedCustomization,
            },
          ];
    });
  const changeQuantity = (id: string, change: number) =>
    setItems((current) =>
      current
        .map((item) =>
          (item.lineId || item.id) === id
            ? {
                ...item,
                quantity: Math.min(
                  priceLevelLineCapacity(
                    current,
                    item.id,
                    item.stock,
                    String(item.customization?.metadata?.batchId || ''),
                    item.lineId || item.id,
                  ),
                  item.quantity + change,
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  const totals = useMemo(
    () => ({
      ...calculateBillingTotals(items, policy, orderDiscount),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [items, orderDiscount, policy],
  );
  const setItemDiscount = (id: string, discount: number) =>
    setItems((current) =>
      current.map((item) =>
        (item.lineId || item.id) === id
          ? { ...item, discount: Math.min(item.price * item.quantity, Math.max(0, discount)) }
          : item,
      ),
    );
  const setItemTaxRate = (id: string, taxRate: number) =>
    setItems((current) =>
      current.map((item) =>
        (item.lineId || item.id) === id ? { ...item, taxRate: Math.max(0, taxRate) } : item,
      ),
    );
  const setOrderDiscount = (discount: number) =>
    setOrderDiscountState(Math.min(totals.subtotal, Math.max(0, discount)));
  const clearCart = () => {
    setItems([]);
    setOrderDiscountState(null);
  };
  const replaceCart = (nextItems: CartItem[], nextOrderDiscount = 0) => {
    setItems(nextItems);
    setOrderDiscountState(nextOrderDiscount);
  };
  return {
    items,
    orderDiscount,
    ...totals,
    addItem,
    changeQuantity,
    setItemDiscount,
    setItemTaxRate,
    setOrderDiscount,
    resetCustomerDiscount: () => setOrderDiscountState(null),
    clearCart,
    replaceCart,
  };
}
