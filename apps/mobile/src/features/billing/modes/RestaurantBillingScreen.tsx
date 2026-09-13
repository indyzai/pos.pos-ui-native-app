import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useRestaurantTables } from '../../restaurant/useRestaurantTables';
import { RestaurantTableSelector } from '../../restaurant/RestaurantTableSelector';
import { RestaurantOrderModeSelector, type RestaurantOrderMode } from '../components/RestaurantOrderMode';
import type { RestaurantTable } from '../../restaurant/types';
import { RestaurantItemDialog } from '../components/RestaurantItemDialog';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';

export function RestaurantBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const auth = useAuthSession();
  const branchId = auth.session?.organization?.activeSession?.branchId;
  const restaurantTables = useRestaurantTables(true, branchId);

  const [restaurantOrderMode, setRestaurantOrderMode] = useState<RestaurantOrderMode>('DINE_IN');
  const [restaurantTable, setRestaurantTable] = useState<RestaurantTable>();
  const [restaurantProduct, setRestaurantProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      headerSlot={
        <>
          {isEnabled('tables') && (
            <RestaurantOrderModeSelector value={restaurantOrderMode} onChange={setRestaurantOrderMode} />
          )}
          {isEnabled('tables') && restaurantOrderMode === 'DINE_IN' && (
            <RestaurantTableSelector
              tables={restaurantTables}
              selectedId={restaurantTable?.id}
              onSelect={setRestaurantTable}
            />
          )}
        </>
      }
      onSelectProduct={(product) => {
        setRestaurantProduct(product);
        return false;
      }}
      onBeforeCheckout={() => {
        if (restaurantOrderMode === 'DINE_IN' && !restaurantTable) {
          showSnackbar('Select a table', 'Choose a table before checking out a dine-in order.');
          return false;
        }
        return true;
      }}
      buildOrderContext={() => ({
        orderMode: restaurantOrderMode,
        tableId: restaurantTable?.id,
        tableName: restaurantTable?.name,
      })}
      onOrderResumed={(order) => {
        if (order.orderContext?.orderMode)
          setRestaurantOrderMode(order.orderContext.orderMode as RestaurantOrderMode);
        setRestaurantTable(
          order.orderContext?.tableId
            ? {
                id: order.orderContext.tableId,
                name: order.orderContext.tableName || 'Table',
                branchId: branchId || '',
                capacity: 0,
                status: 'AVAILABLE',
              }
            : undefined,
        );
      }}
      onOrderCleared={() => {
        setRestaurantTable(undefined);
      }}
      dialogsSlot={({ cart, currencyCode }) => (
        <RestaurantItemDialog
          product={restaurantProduct}
          onClose={() => setRestaurantProduct(undefined)}
          onAdd={cart.addItem}
          currencyCode={currencyCode}
        />
      )}
    />
  );
}
