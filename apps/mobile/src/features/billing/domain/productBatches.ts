import type { Product, ProductBatch, ProductBatchInput } from '../types/billing';
import { pharmacyProductStatus } from './pharmacyProduct';

export function normalizeProductBatches(products: Product[]): ProductBatch[] {
  return products.flatMap((product) => {
    const configured = product.details?.batches;
    const source: ProductBatchInput[] = configured?.length
      ? configured
      : product.details?.batchNumber
        ? [
            {
              batchNumber: product.details.batchNumber,
              expiryDate: product.details.expiryDate,
              stock: product.stock,
              price: product.price,
              manufacturer: product.details.manufacturer,
              schedule: product.details.schedule,
              prescriptionRequired: product.details.prescriptionRequired,
            },
          ]
        : [];
    return source.flatMap((batch, index) => {
      const batchNumber = String(batch.batchNumber || '').trim();
      const stock = Math.max(0, Math.floor(Number(batch.stock ?? product.stock) || 0));
      if (!batchNumber) return [];
      return [
        {
          id: String(batch.id || `${product.id}:${batchNumber}:${index}`),
          productId: product.id,
          batchNumber,
          expiryDate: batch.expiryDate,
          stock,
          price: batch.price == null ? undefined : Number(batch.price),
          manufacturer: batch.manufacturer,
          schedule: batch.schedule,
          prescriptionRequired: batch.prescriptionRequired,
        },
      ];
    });
  });
}

export function batchStatus(batch: ProductBatch, now = new Date()) {
  return pharmacyProductStatus(
    {
      id: batch.productId,
      name: batch.batchNumber,
      category: '',
      price: 0,
      stock: batch.stock,
      emoji: '',
      color: '',
      details: { expiryDate: batch.expiryDate },
    },
    now,
  );
}

export function preferredProductBatch(batches: ProductBatch[], now = new Date()): ProductBatch | undefined {
  return batches
    .filter((batch) => batch.stock > 0 && !batchStatus(batch, now).expired)
    .sort((left, right) => {
      if (!left.expiryDate) return 1;
      if (!right.expiryDate) return -1;
      return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
    })[0];
}
