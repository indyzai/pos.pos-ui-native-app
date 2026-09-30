import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
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
import { OfflineTableName, useAppOfflineEntity } from '../../hooks/useAppOfflineEntity';
import type { RefundRecord } from '@indyzai/feature-orders/types';

export function useOrders() {
  const pathname = usePathname();
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const localOrders = useAppOfflineEntity<SalesOrder, { payload: SalesOrder }>({
    tableName: OfflineTableName.Orders,
    listSelector: (record) => ({ payload: record.payload }),
    pageSize: 100,
  });
  const localSales = useAppOfflineEntity<PendingSale, { payload: PendingSale }>({
    tableName: OfflineTableName.Sales,
    listSelector: (record) => ({ payload: record.payload }),
    pageSize: 100,
  });
  const localProducts = useAppOfflineEntity<Product, { payload: Product }>({
    tableName: OfflineTableName.Products,
    listSelector: (record) => ({ payload: record.payload }),
    pageSize: 100,
  });
  const localRefunds = useAppOfflineEntity<RefundRecord, { payload: RefundRecord }>({
    tableName: OfflineTableName.Refunds,
    listSelector: (record) => ({ payload: record.payload }),
    pageSize: 100,
  });
  useEffect(() => {
    for (const entity of [localOrders, localSales, localProducts, localRefunds]) {
      if (!entity.loading && !entity.loadingMore && entity.localHasMore) void entity.loadMore();
    }
  }, [
    localOrders.loading,
    localOrders.loadingMore,
    localOrders.localHasMore,
    localOrders.loadMore,
    localSales.loading,
    localSales.loadingMore,
    localSales.localHasMore,
    localSales.loadMore,
    localProducts.loading,
    localProducts.loadingMore,
    localProducts.localHasMore,
    localProducts.loadMore,
    localRefunds.loading,
    localRefunds.loadingMore,
    localRefunds.localHasMore,
    localRefunds.loadMore,
  ]);
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
      localOrders.items.map((record) => record.payload),
      localSales.items.map((record) => record.payload),
      localProducts.items.map((record) => record.payload),
    ),
    refunds: localRefunds.items.map((record) => record.payload),
    loading:
      localOrders.loading || localOrders.loadingMore || localRefunds.loading || localRefunds.loadingMore,
    refreshing: refreshMutation.isPending,
    refunding: refundMutation.isPending,
    error:
      local.error ||
      auth.error ||
      localOrders.error?.message ||
      localRefunds.error?.message ||
      String(refreshMutation.error instanceof Error ? refreshMutation.error.message : ''),
    refresh: (signal?: AbortSignal) => refreshMutation.mutateAsync(signal),
    createRefund: refundMutation.mutateAsync,
  };
}
