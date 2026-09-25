import type { NativePrintDocument } from "@indyzai/pos-printing";

type Receipt = {
    id: string;
    businessName: string;
    branchName: string;
    counterName: string;
    createdAt: string;
    currencyCode?: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        discount?: number;
        customization?: {
            label?: string;
            notes?: string;
            metadata?: Record<string, unknown>;
        };
        details?: {
            batchNumber?: string;
            expiryDate?: string;
            serialNumber?: string;
            serviceInstructions?: string;
        };
    }>;
    totals: {
        subtotal: number;
        discount: number;
        tax: number;
        rounding: number;
        total: number;
    };
    payment: {
        method: string;
        tenderedAmount?: number;
        changeDue?: number;
        referenceNumber?: string;
        scrap?: {
            total: number;
            items: Array<{
                productName: string;
                quantity: number;
                unitPrice: number;
            }>;
        };
    };
    customer?: { name: string; gstin?: string };
    orderContext?: unknown;
};
export function receiptDocument(receipt: Receipt): NativePrintDocument {
    const money = (value: number) =>
        `${receipt.currencyCode || "INR"} ${value.toFixed(2)}`;
    return {
        kind: "receipt",
        title: receipt.businessName,
        lines: [
            receipt.branchName,
            receipt.counterName,
            `Receipt ${receipt.id}`,
            receipt.createdAt,
            ...(receipt.customer
                ? [
                      `Customer: ${receipt.customer.name}`,
                      ...(receipt.customer.gstin
                          ? [`GSTIN: ${receipt.customer.gstin}`]
                          : []),
                  ]
                : []),
            ...receipt.items.flatMap((item) => [
                `${item.name}\n${item.quantity} x ${money(item.price)} = ${money(item.quantity * item.price)}`,
                ...(item.discount
                    ? [`Item discount: ${money(item.discount)}`]
                    : []),
                ...(item.customization?.label
                    ? [item.customization.label]
                    : []),
                ...(item.customization?.notes
                    ? [`Notes: ${item.customization.notes}`]
                    : []),
                ...contextLines(item.customization?.metadata),
                ...contextLines(
                    item.details
                        ? {
                              batch: item.details.batchNumber,
                              expiry: item.details.expiryDate,
                              serial: item.details.serialNumber,
                              instructions: item.details.serviceInstructions,
                          }
                        : undefined,
                ),
            ]),
            `Subtotal: ${money(receipt.totals.subtotal)}`,
            `Discount: ${money(receipt.totals.discount)}`,
            `Tax: ${money(receipt.totals.tax)}`,
            `Rounding: ${money(receipt.totals.rounding)}`,
            `TOTAL: ${money(receipt.totals.total)}`,
            `Payment: ${receipt.payment.method}`,
            ...(receipt.payment.tenderedAmount !== undefined
                ? [`Tendered: ${money(receipt.payment.tenderedAmount)}`]
                : []),
            ...(receipt.payment.changeDue !== undefined
                ? [`Change: ${money(receipt.payment.changeDue)}`]
                : []),
            ...(receipt.payment.referenceNumber
                ? [`Reference: ${receipt.payment.referenceNumber}`]
                : []),
            ...(receipt.payment.scrap
                ? [
                      `Scrap exchange: ${money(receipt.payment.scrap.total)}`,
                      ...receipt.payment.scrap.items.map(
                          (item) =>
                              `${item.productName}: ${item.quantity} x ${money(item.unitPrice)}`,
                      ),
                  ]
                : []),
            ...contextLines(receipt.orderContext),
        ],
    };
}

function contextLines(value: unknown, prefix = "", depth = 0): string[] {
    if (!value || typeof value !== "object" || depth > 3) return [];
    return Object.entries(value).flatMap(([key, item]) => {
        const label = prefix ? `${prefix}.${key}` : key;
        if (item == null) return [];
        if (typeof item === "object")
            return contextLines(item, label, depth + 1);
        return ["string", "number", "boolean"].includes(typeof item)
            ? [`${label}: ${String(item)}`]
            : [];
    });
}
