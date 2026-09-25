import { describe, expect, it } from "bun:test";
import type { RefundRecord, SalesOrder } from "@indyzai/feature-orders/types";
import { buildReportMetrics } from "../src/reportMetrics";

const order: SalesOrder = {
    id: "sale-1",
    billId: "B-1",
    subtotal: 100,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 100,
    status: "COMPLETED",
    type: "SALE",
    saleDate: "2026-09-01T10:00:00Z",
    items: [],
};
const refund: RefundRecord = {
    id: "refund-1",
    offlineId: "local-refund-1",
    creditNoteNumber: "CN-1",
    originalSaleId: order.id,
    items: [],
    subtotal: 25,
    tax: 0,
    total: 25,
    refundMethod: "CASH",
    status: "COMPLETED",
    createdAt: "2026-09-22T10:00:00Z",
};
const now = new Date("2026-09-22T12:00:00Z");

describe("shared report date and refund handling", () => {
    it("counts today's refund against an older visible sale", () => {
        const result = buildReportMetrics([order], [refund], 1, now, {
            timeZone: "UTC",
            refundScope: "visible-sales",
        });
        expect(result.orderCount).toBe(0);
        expect(result.refundTotal).toBe(25);
        expect(result.netRevenue).toBe(-25);
    });

    it("still excludes refunds belonging to sales outside the user's scope", () => {
        const result = buildReportMetrics(
            [order],
            [{ ...refund, originalSaleId: "another-user-sale" }],
            1,
            now,
            { refundScope: "visible-sales", timeZone: "UTC" },
        );
        expect(result.refundTotal).toBe(0);
    });

    it("falls back to UTC for an invalid organization timezone", () => {
        const result = buildReportMetrics([], [refund], 1, now, {
            timeZone: "invalid/timezone",
        });
        expect(result.daily[0].date).toBe("2026-09-22");
        expect(result.refundTotal).toBe(25);
    });
});
