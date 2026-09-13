import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { PharmacyBatchDialog } from '../components/PharmacyBatchDialog';
import { ElectronicsItemDialog } from '../components/ElectronicsItemDialog';
import { requiresDeviceDetails } from '../domain/electronicsTracking';
import { pharmacyProductStatus } from '../domain/pharmacyProduct';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';

export function RetailBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const [pharmacyProduct, setPharmacyProduct] = useState<Product>();
  const [electronicsProduct, setElectronicsProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      onSelectProduct={(product, { cart, addStandardProduct, billing }) => {
        const batches = billing.data?.cache.productBatches.filter((b) => b.productId === product.id) || [];
        if (isEnabled('batchExpiry') && pharmacyProductStatus(product).expired) {
          showSnackbar(
            'Expired stock',
            `${product.name} cannot be added because its expiry date has passed.`,
          );
          return false;
        }
        if (isEnabled('batchExpiry') && batches.length) {
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
              billing.data?.cache.productBatches.filter((b) => b.productId === pharmacyProduct?.id) || []
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
