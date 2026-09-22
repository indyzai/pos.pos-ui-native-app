import { expect, test } from "bun:test";
import { buildReportMetrics } from "../src/reportMetrics";
import type { SalesOrder, RefundRecord } from "@indyzai/feature-orders/types";

const order = (id: string, saleDate: string): SalesOrder => ({
    id,
    billId: id,
    saleDate,
    subtotal: 100,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 100,
    status: "COMPLETED",
    type: "SALE",
    items: [],
});

test("daily reports use the organization timezone across UTC midnight", () => {
    const result = buildReportMetrics(
        [
            order("today", "2026-09-21T19:00:00Z"),
            order("yesterday", "2026-09-21T18:00:00Z"),
            order("future", "2026-09-22T10:00:00Z"),
        ],
        [],
        1,
        new Date("2026-09-21T20:00:00Z"),
        { timeZone: "Asia/Kolkata" },
    );
    expect(result.sales.map((sale) => sale.id)).toEqual(["today"]);
    expect(result.daily).toEqual([
        { date: "2026-09-22", revenue: 100, orders: 1 },
    ]);
});

test("cashier reports do not include another sale's refund", () => {
    const refund = {
        originalSaleId: "other",
        total: 50,
        createdAt: "2026-09-22T10:00:00Z",
        status: "COMPLETED",
    } as RefundRecord;
    const result = buildReportMetrics(
        [order("own", "2026-09-22T09:00:00Z")],
        [refund],
        1,
        new Date("2026-09-22T12:00:00Z"),
        { timeZone: "UTC", refundScope: "visible-sales" },
    );
    expect(result.refundTotal).toBe(0);
    expect(result.netRevenue).toBe(100);
});
