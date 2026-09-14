import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { billingApi } from '../billing/billingApi';
import { createReconciliationReportVariables } from './reconciliation';
import type {
  CreateInventoryItemInput,
  ProductReferenceData,
  StockReconciliationInput,
  StockReconciliationReportInput,
  UpdateInventoryItemInput,
} from './types';
import {
  createOutboxJob,
  listOutboxJobs,
  updateOutboxJob,
  type OutboxJob,
} from '@indyzai/pos-database/outbox-jobs';

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

const saveReconciliationDraftMutation = `
  mutation SaveInventoryReconciliationDraft($input: InventoryReconciliationInput!) {
    saveInventoryReconciliationDraft(input: $input)
  }
`;

const createProductMutation = `
  mutation CreateProduct($newProductData: NewProductInput!) {
    newProduct(newProductData: $newProductData) { success message errors product { id } }
  }
`;

const updateProductMutation = `
  mutation UpdateProduct($id: String!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) { success message errors product { id } }
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
  return appStorageKeys.pos.billing(session.user.id, session.tenant.id);
};

async function runTracked(
  operation: OutboxJob['operation'],
  request: () => Promise<string | undefined>,
): Promise<OutboxJob> {
  let job = await createOutboxJob(scope(), operation);
  job = await updateOutboxJob(job, 'RUNNING');
  try {
    const entityId = await request();
    return await updateOutboxJob(job, 'COMPLETED', { entityId });
  } catch (reason) {
    const errorMessage = reason instanceof Error ? reason.message : 'The operation failed.';
    await updateOutboxJob(job, 'FAILED', { errorMessage });
    throw reason;
  }
}

export const inventoryApi = {
  load: billingApi.load,
  listJobs: () => listOutboxJobs(scope()),
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
  async create(input: CreateInventoryItemInput): Promise<OutboxJob> {
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
            status: input.status || 'ACTIVE',
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
  async update(input: UpdateInventoryItemInput): Promise<OutboxJob> {
    const session = context();
    const job = await runTracked('UPDATE_PRODUCT', async () => {
      const data = await requestPos<{
        updateProduct: { success: boolean; product?: { id: string }; message?: string };
      }>(session.token, String(session.tenant.id), updateProductMutation, {
        id: input.productId,
        input: {
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
          status: input.status || 'ACTIVE',
        },
      });
      if (!data.updateProduct?.success || !data.updateProduct.product?.id)
        throw new Error(data.updateProduct?.message || 'Server did not acknowledge the product update.');
      return String(data.updateProduct.product.id);
    });
    await billingApi.refresh();
    return job;
  },
  async reconcileReport(input: StockReconciliationReportInput): Promise<OutboxJob> {
    const session = context();
    const job = await runTracked('UPDATE_STOCK', async () => {
      const data = await requestPos<{ recordInventoryReconciliation?: Array<{ id: string }> }>(
        session.token,
        String(session.tenant.id),
        reconciliationMutation,
        createReconciliationReportVariables(input),
      );
      const movements = data.recordInventoryReconciliation;
      if (!movements?.length || !movements.every((movement) => movement.id))
        throw new Error('Server did not acknowledge the stock update.');
      return movements.map((movement) => String(movement.id)).join(',');
    });
    await billingApi.refresh();
    return job;
  },
  async saveReconciliationDraft(input: StockReconciliationReportInput): Promise<OutboxJob> {
    const session = context();
    return runTracked('SAVE_STOCK_DRAFT', async () => {
      const data = await requestPos<{ saveInventoryReconciliationDraft?: string }>(
        session.token,
        String(session.tenant.id),
        saveReconciliationDraftMutation,
        createReconciliationReportVariables(input),
      );
      if (!data.saveInventoryReconciliationDraft)
        throw new Error('Server did not acknowledge the reconciliation draft.');
      return String(data.saveInventoryReconciliationDraft);
    });
  },
  reconcile(input: StockReconciliationInput): Promise<OutboxJob> {
    return this.reconcileReport({
      items: [{ productId: input.productId, countedQuantity: input.countedQuantity }],
      reference: input.reference,
      remarks: input.remarks,
    });
  },
};
