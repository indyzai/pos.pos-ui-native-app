import type { RefundRecord, SalesOrder } from "@indyzai/feature-orders/types";

export type ReportPeriod = 1 | 7 | 30 | 90;
export interface ReportOptions {
    timeZone?: string;
    refundScope?: "organization" | "visible-sales";
}

export function scopeReportOrders(
    orders: SalesOrder[],
    hasManagerAccess: boolean,
    activeCounterSessionId?: string,
) {
    if (hasManagerAccess) return orders;
    if (!activeCounterSessionId) return [];
    return orders.filter(
        (order) =>
            String(order.counterSessionId || "") === activeCounterSessionId,
    );
}

export function buildReportMetrics(
    orders: SalesOrder[],
    refunds: RefundRecord[],
    period: ReportPeriod,
    now = new Date(),
    options: ReportOptions = {},
) {
    const formatOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    };
    let formatter: Intl.DateTimeFormat;
    try {
        formatter = new Intl.DateTimeFormat("en-US", {
            ...formatOptions,
            timeZone: options.timeZone,
        });
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        // A stale organization setting must not make offline reports unusable.
        formatter = new Intl.DateTimeFormat("en-US", {
            ...formatOptions,
            timeZone: "UTC",
        });
    }
    const dateKey = (date: Date) => {
        const parts = formatter.formatToParts(date);
        return ["year", "month", "day"]
            .map((type) => parts.find((part) => part.type === type)?.value)
            .join("-");
    };
    const end = dateKey(now);
    const startDate = new Date(`${end}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - period + 1);
    const start = startDate.toISOString().slice(0, 10);
    const inPeriod = (value: string) => {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || date > now) return false;
        const key = dateKey(date);
        return key >= start && key <= end;
    };
    const sales = orders
        .filter(
            (order) =>
                inPeriod(order.saleDate) &&
                order.status.toUpperCase() !== "CANCELLED",
        )
        .sort((a, b) => Date.parse(b.saleDate) - Date.parse(a.saleDate));
    const ids = new Set(
        orders.flatMap((sale) =>
            [sale.id, sale.billId, sale.offlineId].filter(Boolean),
        ),
    );
    const periodRefunds = refunds.filter(
        (refund) =>
            inPeriod(refund.createdAt) &&
            !["FAILED", "CANCELLED"].includes(refund.status.toUpperCase()) &&
            (options.refundScope !== "visible-sales" ||
                ids.has(refund.originalSaleId) ||
                ids.has(refund.originalInvoiceNumber)),
    );
    const grossRevenue = sales.reduce(
        (sum, sale) => sum + Number(sale.totalAmount || 0),
        0,
    );
    const refundTotal = periodRefunds.reduce(
        (sum, refund) => sum + Number(refund.total || 0),
        0,
    );
    const taxTotal = sales.reduce(
        (sum, sale) => sum + Number(sale.taxAmount || 0),
        0,
    );
    const payments = new Map<string, number>();
    const products = new Map<
        string,
        { name: string; quantity: number; revenue: number }
    >();
    const daily = new Map<
        string,
        { date: string; revenue: number; orders: number }
    >();
    for (let offset = 0; offset < period; offset++) {
        const date = new Date(startDate);
        date.setUTCDate(date.getUTCDate() + offset);
        const key = date.toISOString().slice(0, 10);
        daily.set(key, { date: key, revenue: 0, orders: 0 });
    }
    for (const sale of sales) {
        const payment =
            sale.paymentType?.name?.trim() ||
            sale.paymentMethod?.trim() ||
            "Other";
        payments.set(
            payment,
            (payments.get(payment) ?? 0) + Number(sale.totalAmount || 0),
        );
        const day = daily.get(dateKey(new Date(sale.saleDate)));
        if (day) {
            day.revenue += Number(sale.totalAmount || 0);
            day.orders++;
        }
        for (const item of sale.items ?? []) {
            const key = String(item.productId);
            const current = products.get(key) ?? {
                name: item.name,
                quantity: 0,
                revenue: 0,
            };
            current.quantity += Number(item.quantity || 0);
            current.revenue += Number(item.lineTotal || 0);
            products.set(key, current);
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
        payments: [...payments.entries()]
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount),
        products: [...products.values()]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5),
    };
}
