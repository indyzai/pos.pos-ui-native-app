import type { Product } from '../billing/types/billing';
import type {
  StockReconciliationInput,
  StockReconciliationRecord,
  StockReconciliationReportInput,
} from './types';

export function createReconciliationReportVariables(
  input: StockReconciliationReportInput,
  timestamp = Date.now(),
) {
  return {
    input: {
      items: input.items.map((item) => ({
        productId: item.productId,
        countedQuantity: item.countedQuantity,
      })),
      ...(input.draftId ? { draftId: input.draftId } : {}),
      reconciliationDate: timestamp,
      reference: input.reference || undefined,
      remarks: input.remarks || undefined,
    },
  };
}

export function createReconciliationVariables(input: StockReconciliationInput, timestamp = Date.now()) {
  return createReconciliationReportVariables(
    {
      items: [{ productId: input.productId, countedQuantity: input.countedQuantity }],
      reference: input.reference,
      remarks: input.remarks,
    },
    timestamp,
  );
}

export function createStockReconciliationRecord(
  product: Product,
  input: StockReconciliationInput,
  status: StockReconciliationRecord['status'],
  timestamp = Date.now(),
): StockReconciliationRecord {
  const previousQuantity = Number(product.stock || 0);
  const lossQuantity = Math.max(0, previousQuantity - input.countedQuantity);
  const createdAt = new Date(timestamp).toISOString();
  return {
    ...input,
    id: `stock-count-${status.toLowerCase()}-${timestamp}-${input.productId}`,
    productName: product.name,
    previousQuantity,
    variance: input.countedQuantity - previousQuantity,
    lossQuantity,
    lossValue: lossQuantity * Number(product.price || 0),
    status,
    createdAt,
    ...(status === 'COMPLETED' ? { completedAt: createdAt } : {}),
  };
}
