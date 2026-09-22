import { expect, test } from "bun:test";
import { calculateBillingTotals } from "../src/domain/billingTotals";
import type { CartItem } from "../src/types/billing";

test("an excessive line discount cannot consume another item or produce a negative bill", () => {
    const item: CartItem = {
        id: "1",
        name: "Item",
        category: "General",
        price: 10,
        stock: 3,
        emoji: "",
        color: "",
        quantity: 1,
        discount: 100,
        taxRate: 10,
    };
    const totals = calculateBillingTotals(
        [item, { ...item, id: "2", discount: 0 }],
        { taxCalculation: "exclusive", roundOffTotal: false },
    );
    expect(totals).toMatchObject({
        subtotal: 20,
        discount: 10,
        tax: 1,
        total: 11,
    });
});
