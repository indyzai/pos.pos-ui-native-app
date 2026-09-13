import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { ElectronicsItemDialog } from '../components/ElectronicsItemDialog';
import { requiresDeviceDetails, validateTrackedDevices } from '../domain/electronicsTracking';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';

export function ElectronicsBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const [electronicsProduct, setElectronicsProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      onSelectProduct={(product, { cart, addStandardProduct }) => {
        if (isEnabled('serialNumbers') && requiresDeviceDetails(product)) {
          setElectronicsProduct(product);
          return false;
        }
        addStandardProduct(product);
        return true;
      }}
      onBeforeCheckout={({ cart }) => {
        const trackingError = validateTrackedDevices(cart.items);
        if (trackingError) {
          showSnackbar('Device details required', trackingError);
          return false;
        }
        return true;
      }}
      dialogsSlot={({ cart }) => (
        <ElectronicsItemDialog
          product={electronicsProduct}
          onClose={() => setElectronicsProduct(undefined)}
          onAdd={(product, customization) => cart.addItem(product, 1, customization)}
        />
      )}
    />
  );
}
