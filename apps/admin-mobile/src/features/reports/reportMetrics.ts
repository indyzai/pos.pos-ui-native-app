import type { RefundRecord, SalesOrder } from '../orders/types';

export type ReportPeriod = 7 | 30 | 90;

export function buildReportMetrics(
    orders: SalesOrder[],
    refunds: RefundRecord[],
    period: ReportPeriod,
    now = new Date(),
) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - period + 1);
    const sales = orders
        .filter((order) => new Date(order.saleDate) >= start && order.status.toUpperCase() !== 'CANCELLED')
        .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
    const periodRefunds = refunds.filter(
        (refund) => new Date(refund.createdAt) >= start && refund.status.toUpperCase() !== 'FAILED',
    );
    const grossRevenue = sales.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const refundTotal = periodRefunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
    const taxTotal = sales.reduce((sum, order) => sum + Number(order.taxAmount || 0), 0);
    const paymentTotals = new Map<string, number>();
    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    const daily = new Map<string, { date: string; revenue: number; orders: number }>();

    for (let offset = 0; offset < period; offset++) {
        const date = new Date(start);
        date.setDate(start.getDate() + offset);
        const key = date.toISOString().slice(0, 10);
        daily.set(key, { date: key, revenue: 0, orders: 0 });
    }
    for (const order of sales) {
        const payment = order.paymentType?.name?.trim() || order.paymentMethod?.trim() || 'Other';
        paymentTotals.set(payment, (paymentTotals.get(payment) ?? 0) + Number(order.totalAmount || 0));
        const day = daily.get(new Date(order.saleDate).toISOString().slice(0, 10));
        if (day) {
            day.revenue += Number(order.totalAmount || 0);
            day.orders++;
        }
        for (const item of order.items ?? []) {
            const current = productTotals.get(String(item.productId)) ?? {
                name: item.name,
                quantity: 0,
                revenue: 0,
            };
            current.quantity += Number(item.quantity || 0);
            current.revenue += Number(item.lineTotal || 0);
            productTotals.set(String(item.productId), current);
        }
    }

    return {
        sales,
        grossRevenue,
        refundTotal,
        netRevenue: grossRevenue - refundTotal,
        taxTotal,
        orderCount: sales.length,
        averageOrder: sales.length ? grossRevenue / sales.length : 0,
        daily: [...daily.values()],
        payments: [...paymentTotals.entries()]
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount),
        products: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
}
