export type ProductBusinessDetails = {
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  salt?: string;
  schedule?: string;
  prescriptionRequired?: boolean;
  scheduledDrug?: boolean;
  serialNumber?: string;
  serialRequired?: boolean;
  warrantyMonths?: number;
  serviceDurationMinutes?: number;
  serviceInstructions?: string;
  serviceUserId?: string | null;
  wholesaleTierPrices?: Array<{ minimumQuantity: number; price: number }>;
  modifiers?: Array<{
    id: string;
    label: string;
    group?: string;
    price?: number;
    singleSelect?: boolean;
  }>;
  isQuickItem?: boolean;
  isFavorite?: boolean;
  batches?: ProductBatchInput[];
};

export type ProductBatchInput = {
  id?: string | number;
  batchNumber: string;
  expiryDate?: string;
  stock?: number;
  price?: number;
  manufacturer?: string;
  schedule?: string;
  prescriptionRequired?: boolean;
};

export type ProductBatch = Omit<ProductBatchInput, 'id' | 'stock'> & {
  id: string;
  productId: string;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  categoryType?: 'INVENTORY' | 'BILL' | 'SCRAP' | 'SERVICE';
  price: number;
  stock: number;
  emoji: string;
  color: string;
  quick?: boolean;
  barcode?: string;
  sku?: string;
  imageUrl?: string;
  taxRate?: number;
  details?: ProductBusinessDetails;
};
export type CartCustomization = {
  key: string;
  label?: string;
  priceAdjustment?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
};
export type CartItem = Product & {
  quantity: number;
  discount?: number;
  lineId?: string;
  customization?: CartCustomization;
};
export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  balance?: number;
  creditLimit?: number;
};
export type ServiceUser = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  specialization?: string;
  isActive?: boolean;
};
export type BankAccount = {
  id: number;
  accountName: string;
  bankName: string;
  upiId?: string;
  isDefault: boolean;
  isActive: boolean;
};
export type BillingPaymentMethod = {
  id: string;
  name: string;
  code: string;
  icon?: string;
  isActive: boolean;
  isQuickAccess: boolean;
  isBankRelated: boolean;
  bankAccountIds: number[];
  defaultBankAccountId?: number;
  bankAccounts: BankAccount[];
};
export type BillingTaxRate = {
  id: string;
  name: string;
  percentage: number;
  isActive: boolean;
};
export type PaymentMethod = string;
export type CheckoutPayment = {
  method: PaymentMethod;
  tenderedAmount?: number;
  changeDue?: number;
  referenceNumber?: string;
  bankAccountId?: number;
  scrap?: ScrapExchange;
};
export type ScrapExchangeItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};
export type ScrapExchange = {
  id: string;
  items: ScrapExchangeItem[];
  total: number;
};
export type HeldOrder = {
  id: string;
  items: CartItem[];
  orderDiscount: number;
  customer?: Customer;
  orderContext?: BillingOrderContext;
  scrapExchange?: ScrapExchange;
  heldAt: string;
};
export type BillingOrderContext = {
  orderMode?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableId?: string;
  tableName?: string;
  doctorName?: string;
  prescriptionReference?: string;
  autoCreateWaybill?: boolean;
  waybillSeller?: {
    name?: string;
    gstin?: string;
    address?: string;
    state?: string;
  };
};
