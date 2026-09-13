export type SalesOrderItem = {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
};

export type SalesOrder = {
    id: string;
    billId: string;
    offlineId?: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    status: string;
    type: string;
    saleDate: string;
    customerName?: string;
    paymentMethod?: string;
    paymentType?: { id: string; name: string; code: string; icon?: string };
    items: SalesOrderItem[];
};

export type RefundItem = {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    refundAmount: number;
    taxAmount: number;
};

export type RefundRecord = {
    id: string;
    offlineId: string;
    creditNoteNumber: string;
    originalInvoiceNumber?: string;
    originalSaleId: string;
    items: RefundItem[];
    subtotal: number;
    tax: number;
    total: number;
    reason?: string;
    refundMethod: string;
    status: string;
    createdAt: string;
    syncError?: string;
};
