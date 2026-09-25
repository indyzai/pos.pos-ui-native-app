import { expect, test } from "bun:test";
import { receiptDocument } from "../src/receiptDocument";
test("native receipt keeps currency, discounts, customization, pharmacy, payment and fulfillment context", () => {
    const document = receiptDocument({
        id: "INV-1",
        businessName: "Shop",
        branchName: "Main",
        counterName: "One",
        createdAt: "2026-09-24",
        currencyCode: "USD",
        items: [
            {
                name: "Item",
                price: 10,
                quantity: 2,
                discount: 1,
                customization: {
                    label: "Large",
                    notes: "No sugar",
                    metadata: { serial: "ABC" },
                },
                details: { batchNumber: "B1", expiryDate: "2027-01-01" },
            },
        ],
        totals: { subtotal: 20, discount: 1, tax: 0, rounding: 0, total: 19 },
        customer: { name: "Customer", gstin: "GST123" },
        payment: {
            method: "cash",
            tenderedAmount: 20,
            changeDue: 1,
            referenceNumber: "REF",
        },
        orderContext: {
            orderMode: "DELIVERY",
            waybillSeller: { name: "Seller" },
        },
    });
    expect(document.lines.join("\n")).toContain("TOTAL: USD 19.00");
    for (const value of [
        "Item discount: USD 1.00",
        "Large",
        "No sugar",
        "serial: ABC",
        "batch: B1",
        "expiry: 2027-01-01",
        "GSTIN: GST123",
        "Change: USD 1.00",
        "Reference: REF",
        "waybillSeller.name: Seller",
    ])
        expect(document.lines.join("\n")).toContain(value);
});
