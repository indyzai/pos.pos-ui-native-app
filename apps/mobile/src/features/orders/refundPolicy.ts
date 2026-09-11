import type { RefundRecord, SalesOrder } from './types';

export type RefundSelection = { productId: string; quantity: number };

export function refundableQuantity(order: SalesOrder, productId: string, refunds: RefundRecord[]): number {
  const sold = order.items.find((item) => item.productId === productId)?.quantity || 0;
  const refunded = refunds
    .filter((refund) => refund.originalSaleId === order.id)
    .flatMap((refund) => refund.items)
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(0, sold - refunded);
}

export function buildPendingRefund(
  order: SalesOrder,
  selections: RefundSelection[],
  existingRefunds: RefundRecord[],
  reason: string,
  refundMethod: string,
  offlineId: string,
  createdAt: string,
): RefundRecord {
  const items = selections.flatMap((selection) => {
    const sold = order.items.find((item) => item.productId === selection.productId);
    const remaining = refundableQuantity(order, selection.productId, existingRefunds);
    if (
      !sold ||
      !Number.isInteger(selection.quantity) ||
      selection.quantity < 1 ||
      selection.quantity > remaining
    )
      return [];
    const ratio = selection.quantity / sold.quantity;
    return [
      {
        productId: sold.productId,
        name: sold.name,
        quantity: selection.quantity,
        unitPrice: sold.unitPrice,
        refundAmount: Math.round((sold.lineTotal - sold.discountAmount) * ratio * 100) / 100,
        taxAmount: Math.round(sold.taxAmount * ratio * 100) / 100,
      },
    ];
  });
  if (!items.length || items.length !== selections.length)
    throw new Error('Select valid refundable quantities.');
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.refundAmount, 0) * 100) / 100;
  const tax = Math.round(items.reduce((sum, item) => sum + item.taxAmount, 0) * 100) / 100;
  return {
    id: offlineId,
    offlineId,
    creditNoteNumber: `CN-${createdAt.slice(0, 10).replace(/-/g, '')}-${offlineId.slice(0, 6).toUpperCase()}`,
    originalInvoiceNumber: order.billId,
    originalSaleId: order.id,
    items,
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100,
    reason: reason.trim() || undefined,
    refundMethod: refundMethod.toUpperCase(),
    status: 'PENDING_SYNC',
    createdAt,
  };
}
