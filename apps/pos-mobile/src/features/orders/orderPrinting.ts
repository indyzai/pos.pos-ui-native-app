import { printingApi } from '../printing/printingApi';
import { receiptDocument } from '@indyzai/feature-printers/receiptDocument';
import type { ReceiptData } from '@indyzai/feature-billing/receipt-dialog';
import type { SalesOrder } from '@indyzai/feature-orders/types';
export async function reprintOrder(order: SalesOrder, receipt: ReceiptData): Promise<string> {
  if (!order.counterId) throw new Error('This order has no counter assigned for receipt printing.');
  const job = await printingApi.queueReceipt(
    order.billId,
    String(order.counterId),
    order.branchId ? String(order.branchId) : undefined,
    receiptDocument(receipt),
  );
  return `${job.status === 'SENT' ? 'Sent to printer' : job.status === 'COMPLETED' ? 'Printed' : job.status === 'SUBMITTED' ? 'Print queued' : 'Print saved for retry'} · ${job.printerName}${job.error ? ` · ${job.error}` : ''}`;
}
