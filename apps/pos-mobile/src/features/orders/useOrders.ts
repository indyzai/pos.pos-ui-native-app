import { useMutation } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useBackgroundRefresh } from '@indyzai/pos-ui-native';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { ordersApi } from './ordersApi';
import { mergeOfflineOrders } from '@indyzai/feature-orders/offlineOrders';
import type { PendingSale } from '@indyzai/feature-billing/salesOutbox';
import type { Product } from '@indyzai/feature-billing/types/billing';
import type { SalesOrder } from '@indyzai/feature-orders/types';
import type { RefundSelection } from '@indyzai/feature-orders/refundPolicy';
import { createOfflineTableHook, payloadsFromRecords } from '@indyzai/pos-database';
import type { RefundRecord } from '@indyzai/feature-orders/types';

const useOrderTable = createOfflineTableHook<SalesOrder>({ table: 'orders', entityType: 'ORDER' });
const useSalesTable = createOfflineTableHook<PendingSale>({ table: 'sales', entityType: 'SALE' });
const useProductsTable = createOfflineTableHook<Product>({ table: 'products' });
const useRefundTable = createOfflineTableHook<RefundRecord>({ table: 'refunds', entityType: 'REFUND' });

export function useOrders() {
  const pathname = usePathname();
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const localOrders = useOrderTable();
  const localSales = useSalesTable();
  const localProducts = useProductsTable();
  const localRefunds = useRefundTable();
  useBackgroundRefresh(
    ready && local.database && (pathname === '/orders' || pathname === '/reports')
      ? `orders:${local.database.scope.tenantId}:${local.database.scope.userId}`
      : undefined,
    async (signal) => {
      await ordersApi.refresh(signal);
    },
  );
  const refreshMutation = useMutation({
    mutationFn: async (signal?: AbortSignal) => {
      if (!ready) return;
      await ordersApi.sync(signal);
      await ordersApi.refresh(signal);
    },
  });
  const refundMutation = useMutation({
    mutationFn: ({
      order,
      selections,
      reason,
      method,
    }: {
      order: SalesOrder;
      selections: RefundSelection[];
      reason: string;
      method: string;
    }) => ordersApi.createRefund(order, selections, reason, method),
  });
  return {
    ready,
    orders: mergeOfflineOrders(
      payloadsFromRecords(localOrders.data),
      payloadsFromRecords(localSales.data),
      payloadsFromRecords(localProducts.data),
    ),
    refunds: payloadsFromRecords(localRefunds.data),
    loading: localOrders.loading || localRefunds.loading,
    refreshing: refreshMutation.isPending,
    refunding: refundMutation.isPending,
    error:
      local.error ||
      auth.error ||
      localOrders.error ||
      localRefunds.error ||
      String(refreshMutation.error instanceof Error ? refreshMutation.error.message : ''),
    refresh: (signal?: AbortSignal) => refreshMutation.mutateAsync(signal),
    createRefund: refundMutation.mutateAsync,
  };
}
