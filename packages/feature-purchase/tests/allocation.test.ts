import { expect, test } from "bun:test";
import { allocatePurchaseSplits } from "../src/domain";

test("splitting costs preserves every cent across equal fractions", () => {
    const parts = Array.from({ length: 3 }, (_, index) => ({
        targetProductName: `Part ${index}`,
        quantity: 1,
        unit: "unit",
    }));
    const split = allocatePurchaseSplits(3, 1, parts);
    expect(split.map((item) => item.allocatedCost)).toEqual([0.34, 0.33, 0.33]);
    expect(
        split.reduce(
            (sum, item) => sum + Math.round(item.allocatedCost * 100),
            0,
        ),
    ).toBe(100);
});

test("invalid source amounts and non-finite split quantities are rejected", () => {
    const parts = [{ targetProductName: "Part", quantity: 1, unit: "unit" }];
    expect(() => allocatePurchaseSplits(1, NaN, parts)).toThrow();
    expect(() => allocatePurchaseSplits(1, -1, parts)).toThrow();
    expect(() =>
        allocatePurchaseSplits(1, 10, [{ ...parts[0], quantity: NaN }]),
    ).toThrow();
});
