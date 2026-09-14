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
  splits: Array<Omit<PurchaseItemSplit, 'allocatedCost' | 'costPerUnit'>>,
): PurchaseItemSplit[] {
  const allocated = splits.reduce((sum, split) => sum + Number(split.quantity), 0);
  if (!splits.length || splits.some((split) => !split.targetProductName.trim() || split.quantity <= 0))
    throw new Error('Every split needs a product name and a positive quantity.');
  if (Math.abs(allocated - sourceQuantity) > 0.0001)
    throw new Error('Split quantities must exactly match the source quantity.');
  return splits.map((split) => {
    const allocatedCost = Number(((split.quantity / allocated) * sourceCost).toFixed(2));
    return {
      ...split,
      allocatedCost,
      costPerUnit: Number((allocatedCost / split.quantity).toFixed(2)),
    };
  });
}
