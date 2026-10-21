import { normalizeProductBatches } from '@indyzai/feature-billing/domain/productBatches';
import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '@indyzai/feature-billing/domain/billingMode';
import type { Product } from '@indyzai/feature-billing/types/billing';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import { PharmacyBatchDialog } from '@indyzai/feature-billing/native/PharmacyBatchDialog';
import { ElectronicsItemDialog } from '@indyzai/feature-billing/native/ElectronicsItemDialog';
import { requiresDeviceDetails } from '@indyzai/feature-billing/domain/electronicsTracking';
import { pharmacyProductStatus } from '@indyzai/feature-billing/domain/pharmacyProduct';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';

export function RetailBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const [pharmacyProduct, setPharmacyProduct] = useState<Product>();
  const [electronicsProduct, setElectronicsProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      onSelectProduct={(product, { addStandardProduct, billing }) => {
        const batches = product.details?.batches?.some((batch) => batch.mrp != null)
          ? normalizeProductBatches([product])
          : billing.data?.cache.productBatches.filter((b) => b.productId === product.id) || [];
        if (isEnabled('batchExpiry') && pharmacyProductStatus(product).expired) {
          showSnackbar(
            'Expired stock',
            `${product.name} cannot be added because its expiry date has passed.`,
          );
          return false;
        }
        if (
          !product.details?.stockBatchId &&
          (batches.some((batch) => batch.mrp != null) || (isEnabled('batchExpiry') && batches.length))
        ) {
          setPharmacyProduct(product);
          return false;
        }
        if (isEnabled('serialNumbers') && requiresDeviceDetails(product)) {
          setElectronicsProduct(product);
          return false;
        }
        addStandardProduct(product);
        return true;
      }}
      dialogsSlot={({ cart, currencyCode, billing }) => (
        <>
          <PharmacyBatchDialog
            product={pharmacyProduct}
            batches={
              pharmacyProduct?.details?.batches?.some((batch) => batch.mrp != null)
                ? normalizeProductBatches([pharmacyProduct])
                : billing.data?.cache.productBatches.filter((b) => b.productId === pharmacyProduct?.id) || []
            }
            currencyCode={currencyCode}
            onClose={() => setPharmacyProduct(undefined)}
            onAdd={(product, customization) => cart.addItem(product, 1, customization)}
          />
          <ElectronicsItemDialog
            product={electronicsProduct}
            onClose={() => setElectronicsProduct(undefined)}
            onAdd={(product, customization) => cart.addItem(product, 1, customization)}
          />
        </>
      )}
    />
  );
}
