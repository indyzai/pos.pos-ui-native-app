import type {
    Product,
    ProductIconKey,
} from "@indyzai/feature-billing/types/billing";

export type InventoryFilter = "all" | "low" | "out";

export type StockReconciliationInput = {
    productId: string;
    countedQuantity: number;
    reference?: string;
    remarks?: string;
};

export type StockReconciliationRecord = StockReconciliationInput & {
    id: string;
    productName: string;
    previousQuantity: number;
    variance: number;
    lossQuantity: number;
    lossValue: number;
    status: "DRAFT" | "COMPLETED";
    createdAt: string;
    completedAt?: string;
    sharedWithCashiers?: boolean;
    createdBy?: string;
    ownedByCurrentUser?: boolean;
};

export type StockReconciliationLine = {
    productId: string;
    productName: string;
    previousQuantity: number;
    countedQuantity: number;
    variance: number;
    lossQuantity: number;
    lossValue: number;
};

export type StockReconciliationReport = {
    id: string;
    lines: StockReconciliationLine[];
    reference?: string;
    remarks?: string;
    status: "DRAFT" | "COMPLETED";
    totalLossQuantity: number;
    totalLossValue: number;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    sharedWithCashiers?: boolean;
    createdBy?: string;
    ownedByCurrentUser?: boolean;
};

export type StockReconciliationReportInput = {
    items: Array<{ productId: string; countedQuantity: number }>;
    draftId?: string;
    reference?: string;
    remarks?: string;
    sharedWithCashiers?: boolean;
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
    status?: "ACTIVE" | "INCOMPLETE";
};

export type UpdateInventoryItemInput = CreateInventoryItemInput & {
    productId: string;
};

export type ProductReferenceData = {
    categories: Array<{ id: number; name: string }>;
    units: Array<{ id: number; name: string; code: string }>;
    taxes: Array<{ id: number; name: string; percentage: number }>;
};
