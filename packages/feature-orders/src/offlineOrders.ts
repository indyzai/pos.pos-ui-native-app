import type { PendingSale } from "@indyzai/feature-billing/salesOutbox";
import type { SalesOrder } from "./types";

/** Include locally completed bills until their authoritative server order arrives. */
export function mergeOfflineOrders(
    orders: readonly SalesOrder[],
    sales: readonly PendingSale[],
    products: readonly { id: string; name: string }[],
): SalesOrder[] {
    const result = [...orders];
    const ids = new Set(
        orders.flatMap((order) => [order.id, order.offlineId].filter(Boolean)),
    );
    const names = new Map(
        products.map((product) => [String(product.id), product.name]),
    );
    for (const sale of sales) {
        const input = sale.input;
        if (!input || !Array.isArray(input.items)) continue;
        const offlineId = String(input.offlineId ?? sale.id);
        if (ids.has(offlineId) || ids.has(sale.id)) continue;
        if (input.status && input.status !== "COMPLETED") continue;
        const payments = Array.isArray(input.payments) ? input.payments : [];
        result.push({
            localOnly: true,
            id: sale.id,
            offlineId,
            billId: sale.receiptNumber,
            subtotal: Number(input.subtotal ?? 0),
            taxAmount: Number(input.taxAmount ?? 0),
            discountAmount: Number(input.discountAmount ?? 0),
            totalAmount: Number(input.totalAmount ?? 0),
            status: "COMPLETED",
            type: String(input.type ?? "SALE"),
            saleDate: String(input.saleDate ?? sale.createdAt),
            counterId:
                input.counterId == null ? undefined : String(input.counterId),
            counterSessionId:
                input.counterSessionId == null
                    ? undefined
                    : String(input.counterSessionId),
            branchId:
                input.branchId == null ? undefined : String(input.branchId),
            paymentMethod:
                payments.length === 1
                    ? String(payments[0].paymentMethod)
                    : undefined,
            items: input.items.map((item) => ({
                productId: String(item.productId),
                name:
                    names.get(String(item.productId)) ?? String(item.productId),
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                discountAmount: Number(item.discountAmount ?? 0),
                taxAmount: Number(item.taxAmount ?? 0),
                lineTotal: Number(item.lineTotal ?? 0),
            })),
        });
        ids.add(offlineId);
    }
    return result;
}
