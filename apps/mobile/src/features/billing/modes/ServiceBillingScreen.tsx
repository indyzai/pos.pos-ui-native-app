import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { ServiceConfigurationDialog } from '../components/ServiceConfigurationDialog';

export function ServiceBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const [serviceProduct, setServiceProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      onSelectProduct={(product, { cart, addStandardProduct }) => {
        if (
          isEnabled('serviceOrders') &&
          (product.categoryType === 'SERVICE' ||
            product.details?.serviceDurationMinutes ||
            product.details?.serviceInstructions)
        ) {
          setServiceProduct(product);
          return false;
        }
        addStandardProduct(product);
        return true;
      }}
      dialogsSlot={({ cart, currencyCode, products, billing }) => (
        <ServiceConfigurationDialog
          product={serviceProduct}
          products={products}
          technicians={billing.data?.cache.serviceUsers || []}
          currencyCode={currencyCode}
          onClose={() => setServiceProduct(undefined)}
          onAdd={(product, customization, parts) => {
            cart.addItem(product, 1, customization);
            for (const part of parts) cart.addItem(part.product, part.quantity);
          }}
        />
      )}
    />
  );
}
