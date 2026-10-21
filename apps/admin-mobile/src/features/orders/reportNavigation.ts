import { router } from 'expo-router';

export function openReportRecords(options: {
  metric: string;
  date: string;
  timeZone: string;
  sessionId: string;
  billId?: string;
}) {
  router.push({ pathname: '/orders', params: options });
}

import { requestPos } from '../../core/api/posApi';
import type { SalesOrder } from '@indyzai/feature-orders/types';

export async function loadReportOrder(token: string, tenantId: string, billId: string, signal?: AbortSignal) {
  const result = await requestPos<{ bill: SalesOrder }>(
    token,
    tenantId,
    `query ReportReceipt($id: String!) { bill(id: $id) { id billId offlineId createdByUserId subtotal taxAmount discountAmount totalAmount status type saleDate counterId counterSessionId branchId customerName payments { paymentMethod amountPaid } paymentMethod paymentType { id name code icon } items { productId stockBatchId mrp name quantity unitPrice discountAmount taxAmount lineTotal } } }`,
    { id: billId },
    signal,
  );
  return result.bill;
}

import type { WidgetNavigation } from '@indyzai/feature-reports/widgetNavigation';

export function openReportWidget({ page, ...params }: WidgetNavigation) {
  router.push({ pathname: `/${page}`, params });
}
