import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { BulkQuantityDialog } from '../components/BulkQuantityDialog';
import { canManageWaybills } from '../../logistics/permissions';

export function WholesaleBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const auth = useAuthSession();
  const [bulkProduct, setBulkProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      onSelectProduct={(product, { cart, addStandardProduct }) => {
        if (isEnabled('bulkPricing')) {
          setBulkProduct(product);
          return false;
        }
        addStandardProduct(product);
        return true;
      }}
      buildOrderContext={({ customer }) => {
        if (customer?.address && canManageWaybills(auth.session?.tenant.role)) {
          return {
            autoCreateWaybill: true,
            waybillSeller: {
              name: auth.session?.organization?.name || auth.session?.tenant.name,
              gstin: String(auth.session?.organization?.settings.gstin || ''),
              address: String(auth.session?.organization?.settings.address || ''),
              state: String(auth.session?.organization?.settings.state || ''),
            },
          };
        }
        return undefined;
      }}
      dialogsSlot={({ cart, currencyCode }) => (
        <BulkQuantityDialog
          product={bulkProduct}
          onClose={() => setBulkProduct(undefined)}
          onAdd={cart.addItem}
          currencyCode={currencyCode}
        />
      )}
    />
  );
}
