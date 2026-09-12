import type { StockReconciliationInput } from './types';

export function createReconciliationVariables(input: StockReconciliationInput, timestamp = Date.now()) {
    return {
        input: {
            items: [{ productId: input.productId, countedQuantity: input.countedQuantity }],
            reconciliationDate: timestamp,
            reference: input.reference || undefined,
            remarks: input.remarks || undefined,
        },
    };
}
