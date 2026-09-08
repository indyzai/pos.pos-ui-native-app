import type { Product } from '../billing/types/billing';

export type InventoryFilter = 'all' | 'low' | 'out';

export type StockReconciliationInput = {
  productId: string;
  countedQuantity: number;
  reference?: string;
  remarks?: string;
};

export type InventorySummary = {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
};

export type InventoryProduct = Product;

export type CreateInventoryItemInput = {
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category?: string;
};
