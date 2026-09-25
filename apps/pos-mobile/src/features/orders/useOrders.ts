import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import {
  createLocalFirstTableHook,
  payloadsFromRecords,
  applyBootstrapCollections,
  getActiveDatabase,
} from '@indyzai/pos-database';
import type { RefundRecord } from '@indyzai/feature-orders/types';

const useOrderTable = createLocalFirstTableHook<SalesOrder>({ table: 'orders', entityType: 'ORDER' });
const useSalesTable = createLocalFirstTableHook<PendingSale>({ table: 'sales', entityType: 'SALE' });
const useProductsTable = createLocalFirstTableHook<Product>({ table: 'products' });
const useRefundTable = createLocalFirstTableHook<RefundRecord>({ table: 'refunds', entityType: 'REFUND' });

export function useOrders() {
  const pathname = usePathname();
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const [projectionError, setProjectionError] = useState('');
  const client = useQueryClient();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const key = ['orders', auth.session?.user.id, auth.session?.tenant.id];
  const query = useQuery({
    queryKey: key,
    enabled: ready,
    queryFn: ordersApi.load,
    retry: false,
    networkMode: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const localOrders = useOrderTable();
  const localSales = useSalesTable();
  const localProducts = useProductsTable();
  const localRefunds = useRefundTable();
  useEffect(() => {
    if (!local.database || !query.data) return;
    const database = local.database;
    const snapshot = query.data;
    // One-time migration from the older repository; never replace an existing projection on mount.
    void Promise.all(
      (['orders', 'refunds'] as const).map(async (table) => {
        if (
          !(await database.collection(table).list()).length &&
          snapshot[table].length &&
          getActiveDatabase() === database
        )
          await applyBootstrapCollections(database, { [table]: snapshot[table] });
      }),
    ).then(
      () => setProjectionError(''),
      (reason) =>
        setProjectionError(reason instanceof Error ? reason.message : 'Unable to update local orders.'),
    );
  }, [local.database, query.data]);
  const projectSnapshot = async () => {
    const database = local.database;
    if (!database || getActiveDatabase() !== database) return;
    const snapshot = await ordersApi.load();
    if (getActiveDatabase() !== database) return;
    await applyBootstrapCollections(database, { orders: snapshot.orders, refunds: snapshot.refunds });
  };
  useBackgroundRefresh(
    ready && local.database && (pathname === '/orders' || pathname === '/reports')
      ? `orders:${local.database.scope.tenantId}:${local.database.scope.userId}`
      : undefined,
    async (signal) => {
      await ordersApi.refresh(signal);
      if (!signal.aborted) await projectSnapshot();
    },
  );
  const refreshMutation = useMutation({
    mutationFn: async (signal?: AbortSignal) => {
      if (!ready) return;
      await ordersApi.sync(signal);
      await ordersApi.refresh(signal);
      await projectSnapshot();
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
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
    onSuccess: async () => {
      await projectSnapshot();
      await client.invalidateQueries({ queryKey: key });
    },
  });
  return {
    ready,
    orders: mergeOfflineOrders(
      payloadsFromRecords(localOrders.data),
      payloadsFromRecords(localSales.data),
      payloadsFromRecords(localProducts.data),
    ),
    refunds: payloadsFromRecords(localRefunds.data),
    loading: query.isFetching,
    refreshing: refreshMutation.isPending,
    refunding: refundMutation.isPending,
    error:
      local.error ||
      auth.error ||
      projectionError ||
      String(
        refreshMutation.error instanceof Error
          ? refreshMutation.error.message
          : query.error instanceof Error
            ? query.error.message
            : '',
      ),
    refresh: (signal?: AbortSignal) => refreshMutation.mutateAsync(signal),
    createRefund: refundMutation.mutateAsync,
  };
}
