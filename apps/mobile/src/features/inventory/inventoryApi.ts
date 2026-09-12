import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { billingApi } from '../billing/billingApi';
import { createReconciliationVariables } from './reconciliation';
import type { CreateInventoryItemInput, ProductReferenceData, StockReconciliationInput } from './types';
import { createSyncJob, listSyncJobs, updateSyncJob, type SyncJob } from '../../sync/syncJobRepository';

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
    newProduct(newProductData: $newProductData) { success message errors product { id } }
  }
`;

const productReferencesQuery = `
  query InventoryProductReferences {
    categories(type: "INVENTORY", skip: 0, take: 200) { id name isActive }
    units { id name code }
    taxes { id name percentage isActive }
  }
`;

const referenceCache = new Map<string, ProductReferenceData>();

function context() {
  const session = getActiveAuthSession();
  if (!session) throw new Error('Your workspace is still initializing. Please try again.');
  return session;
}

const scope = () => {
  const session = context();
  return `indyz.billing.v1:${session.user.id}:${session.tenant.id}`;
};

async function runTracked(
  operation: SyncJob['operation'],
  request: () => Promise<string | undefined>,
): Promise<SyncJob> {
  let job = await createSyncJob(scope(), operation);
  job = await updateSyncJob(job, 'RUNNING');
  try {
    const entityId = await request();
    return await updateSyncJob(job, 'COMPLETED', { entityId });
  } catch (reason) {
    const errorMessage = reason instanceof Error ? reason.message : 'The operation failed.';
    await updateSyncJob(job, 'FAILED', { errorMessage });
    throw reason;
  }
}

export const inventoryApi = {
  load: billingApi.load,
  listJobs: () => listSyncJobs(scope()),
  refresh: (signal?: AbortSignal) => billingApi.refresh(signal),
  async loadProductReferences(): Promise<ProductReferenceData> {
    const session = context();
    const tenantId = String(session.tenant.id);
    const cached = referenceCache.get(tenantId);
    if (cached) return cached;
    const data = await requestPos<{
      categories: Array<{ id: string | number; name: string; isActive?: boolean }>;
      units: Array<{ id: string | number; name: string; code: string }>;
      taxes: Array<{ id: string | number; name: string; percentage: number; isActive?: boolean }>;
    }>(session.token, tenantId, productReferencesQuery);
    const references: ProductReferenceData = {
      categories: data.categories
        .filter((item) => item.isActive !== false)
        .map((item) => ({ id: Number(item.id), name: item.name })),
      units: data.units.map((item) => ({ id: Number(item.id), name: item.name, code: item.code })),
      taxes: data.taxes
        .filter((item) => item.isActive !== false)
        .map((item) => ({ id: Number(item.id), name: item.name, percentage: Number(item.percentage) })),
    };
    referenceCache.set(tenantId, references);
    return references;
  },
  async create(input: CreateInventoryItemInput): Promise<SyncJob> {
    const session = context();
    const job = await runTracked('CREATE_PRODUCT', async () => {
      const data = await requestPos<{ newProduct: { product?: { id: string }; message?: string } }>(
        session.token,
        String(session.tenant.id),
        createProductMutation,
        {
          newProductData: {
            name: input.name,
            price: input.price,
            costPrice: input.costPrice,
            quantity: input.stock,
            minStock: input.minStock,
            barcode: input.barcode || undefined,
            skuCode: input.skuCode || undefined,
            notes: input.notes || undefined,
            categoryId: input.categoryId,
            category: input.category || undefined,
            unitId: input.unitId,
            taxId: input.taxId,
            details: { iconKey: input.iconKey },
            status: 'ACTIVE',
          },
        },
      );
      if (!data.newProduct?.product?.id)
        throw new Error(data.newProduct?.message || 'Server did not acknowledge the product.');
      return String(data.newProduct.product.id);
    });
    await billingApi.refresh();
    return job;
  },
  async reconcile(input: StockReconciliationInput): Promise<SyncJob> {
    const session = context();
    const job = await runTracked('UPDATE_STOCK', async () => {
      const data = await requestPos<{ recordInventoryReconciliation?: { id: string } }>(
        session.token,
        String(session.tenant.id),
        reconciliationMutation,
        createReconciliationVariables(input),
      );
      if (!data.recordInventoryReconciliation?.id)
        throw new Error('Server did not acknowledge the stock update.');
      return String(data.recordInventoryReconciliation.id);
    });
    await billingApi.refresh();
    return job;
  },
};
