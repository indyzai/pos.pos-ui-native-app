import { expect, test } from "bun:test";
import { mergeOfflineOrders } from "../src/offlineOrders";
import { buildPendingRefund } from "../src/refundPolicy";
import type { PendingSale } from "@indyzai/feature-billing/salesOutbox";

const sale = {
    id: "offline-1",
    receiptNumber: "LOCAL-1",
    createdAt: "2026-09-24T10:00:00Z",
    input: {
        offlineId: "offline-1",
        status: "COMPLETED",
        subtotal: 10,
        totalAmount: 10,
        counterSessionId: 12,
        payments: [{ paymentMethod: "CASH", amountPaid: 10 }],
        items: [{ productId: 1, quantity: 2, unitPrice: 5, lineTotal: 10 }],
    },
} as unknown as PendingSale;

test("offline bills remain available to reports before server synchronization", () => {
    const [order] = mergeOfflineOrders([], [sale], [{ id: "1", name: "Tea" }]);
    expect(order.totalAmount).toBe(10);
    expect(order.counterSessionId).toBe("12");
    expect(order.items[0].name).toBe("Tea");
    expect(order.paymentMethod).toBe("CASH");
});

test("server order wins without double-counting the offline bill", () => {
    const [local] = mergeOfflineOrders([], [sale], []);
    const server = { ...local, id: "123", billId: "INV-123", localOnly: false };
    expect(mergeOfflineOrders([server], [sale], [])).toEqual([server]);
    expect(mergeOfflineOrders([], [sale, sale], [])).toHaveLength(1);
});

test("refunds wait for the authoritative server bill ID", () => {
    const [local] = mergeOfflineOrders([], [sale], []);
    expect(() =>
        buildPendingRefund(
            local,
            [],
            [],
            "",
            "CASH",
            "refund-1",
            sale.createdAt,
        ),
    ).toThrow("Sync this bill");
});
