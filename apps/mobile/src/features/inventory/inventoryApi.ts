import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { billingApi } from '../billing/billingApi';
import { createReconciliationVariables } from './reconciliation';
import type { CreateInventoryItemInput, StockReconciliationInput } from './types';

const reconciliationMutation = `
  mutation RecordInventoryReconciliation($input: InventoryReconciliationInput!) {
    recordInventoryReconciliation(input: $input) {
      id
      stockBefore
      stockAfter
      product { id name price quantity barcode category { name } tax { percentage rate } }
    }
  }
`;

const createProductMutation = `
  mutation CreateProduct($newProductData: NewProductInput!) {
    newProduct(newProductData: $newProductData) { product { id } }
  }
`;

function context() {
  const session = getActiveAuthSession();
  if (!session) throw new Error('Your workspace is still initializing. Please try again.');
  return session;
}

export const inventoryApi = {
  load: billingApi.load,
  refresh: billingApi.refresh,
  async create(input: CreateInventoryItemInput): Promise<void> {
    const session = context();
    await requestPos(session.token, String(session.tenant.id), createProductMutation, {
      newProductData: {
        name: input.name,
        price: input.price,
        quantity: input.stock,
        barcode: input.barcode || undefined,
        category: input.category || undefined,
        status: 'ACTIVE',
      },
    });
    await billingApi.refresh();
  },
  async reconcile(input: StockReconciliationInput): Promise<void> {
    const session = context();
    await requestPos(
      session.token,
      String(session.tenant.id),
      reconciliationMutation,
      createReconciliationVariables(input),
    );
    await billingApi.refresh();
  },
};
