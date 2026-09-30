import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'expo-router';
import { createScopeKey } from '@indyzai/pos-database';
import { useBackgroundRefresh } from '@indyzai/pos-ui-native';
import { printerConfigurationApi } from '../../printing/printerConfigurationApi';
import { getNetworkStatusSnapshot } from '@indyzai/pos-ui-native';
import { billingApi, type BillingCache } from '../billingApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { printingApi } from '../../printing/printingApi';
import { createOfflineTableHook, payloadsFromRecords } from '@indyzai/pos-database';
import type {
  BillingPaymentMethod,
  BillingTaxRate,
  Customer,
  Product,
  ProductBatch,
  ServiceUser,
} from '@indyzai/feature-billing/types/billing';
import { resolveBillingMode, type BillingMode } from '@indyzai/feature-billing/domain/billingMode';
import { useBillingSales } from './useBillingSales';
import { OfflineTableName, useAppOfflineEntity } from '../../../hooks/useAppOfflineEntity';

const useCustomerTable = createOfflineTableHook<Customer>({ table: 'customers', entityType: 'CUSTOMER' });
const usePaymentMethodTable = createOfflineTableHook<BillingPaymentMethod>({
  table: 'payment_methods',
  entityType: 'PAYMENT_METHOD',
});
const useServiceUserTable = createOfflineTableHook<ServiceUser>({
  table: 'service_users',
  entityType: 'SERVICE_USER',
});
const useProductBatchTable = createOfflineTableHook<ProductBatch>({
  table: 'product_batches',
  entityType: 'PRODUCT_BATCH',
});
const useTaxRateTable = createOfflineTableHook<BillingTaxRate>({
  table: 'tax_rates',
  entityType: 'TAX_RATE',
});

export function useBillingData(businessTypeOverride?: BillingMode) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const auth = useAuthSession();
  const currentMode =
    businessTypeOverride ?? resolveBillingMode(auth.session?.organization?.settings.businessType).mode;
  const local = useLocalDatabase();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const pageScope =
    ready && local.database && pathname === '/billing' ? createScopeKey(local.database.scope) : undefined;
  const counterId = auth.session?.organization?.activeSession?.counterId;
  useBackgroundRefresh(pageScope ? `billing:${pageScope}` : undefined, (signal) =>
    billingApi.refresh(signal, local.database),
  );
  useBackgroundRefresh(
    pageScope && counterId ? `billing-printers:${pageScope}:${counterId}` : undefined,
    (signal) => printerConfigurationApi.refresh(counterId, signal),
  );
  const userId = auth.session?.user.id;
  const tenantId = auth.session?.tenant.id;
  const query = useQuery<{ key: string; cache: BillingCache }>({
    queryKey: ['billing-cache', userId, tenantId, currentMode],
    enabled: ready,
    networkMode: 'always',
    queryFn: billingApi.load,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const localProducts = useAppOfflineEntity<Product>({
    tableName: OfflineTableName.Products,
    storeId: local.scope?.storeIds[0] ?? null,
    listSelector: (record) => record.payload,
    pageSize: 100,
  });
  const localCustomers = useCustomerTable();
  const localPaymentMethods = usePaymentMethodTable();
  const localServiceUsers = useServiceUserTable();
  const localProductBatches = useProductBatchTable();
  const localTaxRates = useTaxRateTable();
  const sales = useBillingSales();

  useEffect(() => {
    if (localProducts.loading || localProducts.loadingMore || !localProducts.localHasMore) return;
    void localProducts.loadMore();
  }, [localProducts.loadMore, localProducts.loading, localProducts.loadingMore, localProducts.localHasMore]);

  const syncMutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (signal?: AbortSignal) => {
      await billingApi.sync(signal);
      await printingApi.syncPending();
      await billingApi.refresh(signal, local.database);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['billing-cache'] });
    },
  });
  const reload = async () => {
    await query.refetch();
  };
  const refresh = async (signal?: AbortSignal) => {
    if (!auth.initializing && !auth.session) {
      await auth.refreshSession();
      return;
    }
    if (!ready || running.current) return;
    running.current = true;
    try {
      await syncMutation.mutateAsync(signal);
    } catch {
      // TanStack Query retains the mutation error for the billing status UI.
    } finally {
      running.current = false;
    }
  };
  const settings = auth.session?.organization?.settings;
  const autoRefreshEnabled = settings?.autoRefresh === true || settings?.autoRefreshEnabled === true;
  const autoRefreshSeconds = Math.max(15, Number(settings?.autoRefreshIntervalSeconds ?? 60));
  useEffect(() => {
    if (!autoRefreshEnabled || !ready || !local.database || pathname !== '/billing') return;
    let controller: AbortController | undefined;
    const timer = setInterval(() => {
      if (running.current || controller || !local.database || getNetworkStatusSnapshot() !== true) return;
      controller = new AbortController();
      const active = controller;
      const timeout = setTimeout(() => active.abort(), 12000);
      void billingApi
        .refresh(active.signal, local.database)
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(timeout);
          controller = undefined;
        });
    }, autoRefreshSeconds * 1000);
    return () => {
      clearInterval(timer);
      controller?.abort();
    };
  }, [autoRefreshEnabled, autoRefreshSeconds, local.database, ready, pathname]);
  const error = syncMutation.error ?? query.error;
  const data = useMemo(() => {
    if (!ready || !query.data) return undefined;
    return {
      ...query.data,
      cache: {
        ...query.data.cache,
        products: localProducts.items,
        customers: payloadsFromRecords(localCustomers.data),
        paymentMethods: localPaymentMethods.data.length
          ? payloadsFromRecords(localPaymentMethods.data)
          : query.data.cache.paymentMethods,
        serviceUsers: currentMode === 'service' ? payloadsFromRecords(localServiceUsers.data) : [],
        productBatches: currentMode === 'pharmacy' ? payloadsFromRecords(localProductBatches.data) : [],
        taxRates: payloadsFromRecords(localTaxRates.data),
      },
    };
  }, [
    currentMode,
    localCustomers.data,
    localPaymentMethods.data,
    localProductBatches.data,
    localProducts.items,
    localServiceUsers.data,
    localTaxRates.data,
    query.data,
    ready,
  ]);
  return {
    data,
    error:
      local.error ||
      auth.error ||
      localProducts.error?.message ||
      (error instanceof Error ? error.message : ''),
    busy: query.isFetching || syncMutation.isPending || localProducts.loading || sales.loading,
    sales,
    refresh,
    reload,
  };
}
