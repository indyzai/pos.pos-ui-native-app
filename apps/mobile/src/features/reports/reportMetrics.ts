import type { RefundRecord, SalesOrder } from '../orders/types';
export type ReportPeriod = 1 | 7 | 30;

export function scopeReportOrders(
  orders: SalesOrder[],
  hasManagerAccess: boolean,
  activeCounterSessionId?: string,
) {
  if (hasManagerAccess) return orders;
  if (!activeCounterSessionId) return [];
  return orders.filter((order) => String(order.counterSessionId || '') === activeCounterSessionId);
}

export function buildReportMetrics(orders: SalesOrder[], refunds: RefundRecord[], period: ReportPeriod, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - period + 1);
  const sales = orders.filter((order) => new Date(order.saleDate) >= start && order.status.toUpperCase() !== 'CANCELLED')
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  const ids = new Set(sales.flatMap((sale) => [sale.id, sale.billId, sale.offlineId].filter((id): id is string => Boolean(id))));
  const visibleRefunds = refunds.filter((refund) => new Date(refund.createdAt) >= start && refund.status.toUpperCase() !== 'FAILED' &&
    (ids.has(refund.originalSaleId) || Boolean(refund.originalInvoiceNumber && ids.has(refund.originalInvoiceNumber))));
  const grossRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const refundTotal = visibleRefunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
  const payments = new Map<string, number>();
  const products = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const sale of sales) {
    const payment = sale.paymentType?.name || sale.paymentMethod || 'Other';
    payments.set(payment, (payments.get(payment) ?? 0) + Number(sale.totalAmount || 0));
    for (const item of sale.items ?? []) {
      const current = products.get(item.productId) ?? { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity || 0); current.revenue += Number(item.lineTotal || 0); products.set(item.productId, current);
    }
  }
  return { sales, netRevenue: grossRevenue - refundTotal, refundTotal,
    taxTotal: sales.reduce((sum, sale) => sum + Number(sale.taxAmount || 0), 0), orderCount: sales.length,
    averageOrder: sales.length ? grossRevenue / sales.length : 0,
    payments: [...payments.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5) };
}
