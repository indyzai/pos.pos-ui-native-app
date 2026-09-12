import type { Product } from '../billing/types/billing';
import type { ProductIconKey } from '../billing/components/productIcons';

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
  costPrice?: number;
  stock: number;
  minStock?: number;
  barcode?: string;
  skuCode?: string;
  category?: string;
  categoryId?: number;
  unitId?: number;
  taxId?: number;
  notes?: string;
  iconKey: ProductIconKey;
};

export type ProductReferenceData = {
  categories: Array<{ id: number; name: string }>;
  units: Array<{ id: number; name: string; code: string }>;
  taxes: Array<{ id: number; name: string; percentage: number }>;
};
