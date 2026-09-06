import { useMemo, useState } from 'react';
import type { CartItem, Product } from '../types/billing';

export function useBillingCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const addItem = (product: Product) =>
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing
        ? current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { ...product, quantity: 1 }];
    });
  const changeQuantity = (id: string, change: number) =>
    setItems((current) =>
      current
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + change } : item))
        .filter((item) => item.quantity > 0),
    );
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      subtotal,
      tax: subtotal * 0.05,
      total: subtotal * 1.05,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [items]);
  return { items, ...totals, addItem, changeQuantity, clearCart: () => setItems([]) };
}
