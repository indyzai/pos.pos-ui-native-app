import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '@indyzai/feature-billing/domain/billingMode';
import type { Product } from '@indyzai/feature-billing/types/billing';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import { ElectronicsItemDialog } from '../components/ElectronicsItemDialog';
import { requiresDeviceDetails, validateTrackedDevices } from '@indyzai/feature-billing/domain/electronicsTracking';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';

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
