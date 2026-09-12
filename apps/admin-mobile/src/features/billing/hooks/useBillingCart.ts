import { useMemo, useState } from 'react';
import type { CartCustomization, CartItem, Product } from '../types/billing';
import { calculateBillingTotals, type BillingCalculationPolicy } from '../domain/billingTotals';

export function useBillingCart(policy: BillingCalculationPolicy) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [orderDiscount, setOrderDiscountState] = useState(0);
    const addItem = (product: Product, quantity = 1, customization?: CartCustomization) =>
        setItems((current) => {
            const lineId = customization ? `${product.id}:${customization.key}` : product.id;
            const existing = current.find((item) => (item.lineId || item.id) === lineId);
            if (product.stock <= 0 || (existing && existing.quantity >= product.stock)) return current;
            const amount = Math.max(1, Math.floor(quantity));
            return existing
                ? current.map((item) =>
                      (item.lineId || item.id) === lineId
                          ? { ...item, quantity: Math.min(item.stock, item.quantity + amount) }
                          : item,
                  )
                : [
                      ...current,
                      {
                          ...product,
                          price: product.price + (customization?.priceAdjustment || 0),
                          quantity: Math.min(product.stock, amount),
                          discount: 0,
                          lineId,
                          customization,
                      },
                  ];
        });
    const changeQuantity = (id: string, change: number) =>
        setItems((current) =>
            current
                .map((item) =>
                    (item.lineId || item.id) === id
                        ? { ...item, quantity: Math.min(item.stock, item.quantity + change) }
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
        setOrderDiscountState(0);
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
        clearCart,
        replaceCart,
    };
}
