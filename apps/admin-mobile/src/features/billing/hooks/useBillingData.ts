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
import { createLocalFirstTableHook, payloadsFromRecords } from '@indyzai/pos-database';
import type {
  BillingPaymentMethod,
  BillingTaxRate,
  Customer,
  Product,
  ProductBatch,
  ServiceUser,
} from '@indyzai/feature-billing/types/billing';

const useProductTable = createLocalFirstTableHook<Product>({ table: 'products', entityType: 'PRODUCT' });
const useCustomerTable = createLocalFirstTableHook<Customer>({ table: 'customers', entityType: 'CUSTOMER' });
const usePaymentMethodTable = createLocalFirstTableHook<BillingPaymentMethod>({
  table: 'payment_methods',
  entityType: 'PAYMENT_METHOD',
});
const useServiceUserTable = createLocalFirstTableHook<ServiceUser>({
  table: 'service_users',
  entityType: 'SERVICE_USER',
});
const useProductBatchTable = createLocalFirstTableHook<ProductBatch>({
  table: 'product_batches',
  entityType: 'PRODUCT_BATCH',
});
const useTaxRateTable = createLocalFirstTableHook<BillingTaxRate>({
  table: 'tax_rates',
  entityType: 'TAX_RATE',
});

export function useBillingData() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const auth = useAuthSession();
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
    queryKey: ['billing-cache', userId, tenantId],
    enabled: ready,
    networkMode: 'always',
    queryFn: billingApi.load,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const localProducts = useProductTable();
  const localCustomers = useCustomerTable();
  const localPaymentMethods = usePaymentMethodTable();
  const localServiceUsers = useServiceUserTable();
  const localProductBatches = useProductBatchTable();
  const localTaxRates = useTaxRateTable();

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
        products: payloadsFromRecords(localProducts.data),
        customers: payloadsFromRecords(localCustomers.data),
        paymentMethods: payloadsFromRecords(localPaymentMethods.data),
        serviceUsers: payloadsFromRecords(localServiceUsers.data),
        productBatches: payloadsFromRecords(localProductBatches.data),
        taxRates: payloadsFromRecords(localTaxRates.data),
      },
    };
  }, [
    localCustomers.data,
    localPaymentMethods.data,
    localProductBatches.data,
    localProducts.data,
    localServiceUsers.data,
    localTaxRates.data,
    query.data,
    ready,
  ]);
  return {
    data,
    error: local.error || auth.error || (error instanceof Error ? error.message : ''),
    busy: query.isFetching || syncMutation.isPending,
    refresh,
    reload,
  };
}
