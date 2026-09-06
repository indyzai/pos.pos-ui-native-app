export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  emoji: string;
  color: string;
  quick?: boolean;
};
export type CartItem = Product & { quantity: number };
export type PaymentMethod = 'Cash' | 'UPI' | 'Card';
