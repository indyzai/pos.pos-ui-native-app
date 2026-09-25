export type PurchaseItemSplit = {
    targetProductId?: string;
    targetProductName: string;
    quantity: number;
    unit: string;
    allocatedCost: number;
    costPerUnit: number;
};

export function allocatePurchaseSplits(
    sourceQuantity: number,
    sourceCost: number,
    splits: Array<Omit<PurchaseItemSplit, "allocatedCost" | "costPerUnit">>,
): PurchaseItemSplit[] {
    if (
        !Number.isFinite(sourceQuantity) ||
        sourceQuantity <= 0 ||
        !Number.isFinite(sourceCost) ||
        sourceCost < 0
    ) {
        throw new Error(
            "Source quantity must be positive and cost must be non-negative.",
        );
    }
    const allocated = splits.reduce(
        (sum, split) => sum + Number(split.quantity),
        0,
    );
    if (
        !splits.length ||
        splits.some(
            (split) =>
                !split.targetProductName.trim() ||
                !Number.isFinite(split.quantity) ||
                split.quantity <= 0,
        )
    )
        throw new Error(
            "Every split needs a product name and a positive quantity.",
        );
    if (Math.abs(allocated - sourceQuantity) > 0.0001)
        throw new Error(
            "Split quantities must exactly match the source quantity.",
        );
    const totalCents = Math.round(sourceCost * 100);
    if (!Number.isSafeInteger(totalCents))
        throw new Error("Source cost is too large.");
    const exact = splits.map(
        (split) => (split.quantity / allocated) * totalCents,
    );
    const cents = exact.map(Math.floor);
    const remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);
    const priority = exact
        .map((value, index) => ({ index, fraction: value - cents[index] }))
        .sort(
            (left, right) =>
                right.fraction - left.fraction || left.index - right.index,
        );
    for (let index = 0; index < remainder; index++)
        cents[priority[index % priority.length].index]++;
    return splits.map((split, index) => {
        const allocatedCost = cents[index] / 100;
        return {
            ...split,
            allocatedCost,
            costPerUnit: Number((allocatedCost / split.quantity).toFixed(2)),
        };
    });
}
