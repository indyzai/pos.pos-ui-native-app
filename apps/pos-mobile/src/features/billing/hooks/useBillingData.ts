import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { billingApi, type BillingCache } from '../billingApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { printingApi } from '../../printing/printingApi';
import {
  createLocalFirstTableHook,
  payloadsFromRecords,
} from '@indyzai/pos-database';
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

export function useBillingData(businessTypeOverride?: BillingMode) {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const auth = useAuthSession();
  const currentMode =
    businessTypeOverride ?? resolveBillingMode(auth.session?.organization?.settings.businessType).mode;
  const local = useLocalDatabase();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
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
  const localProducts = useProductTable();
  const localCustomers = useCustomerTable();
  const localPaymentMethods = usePaymentMethodTable();
  const localServiceUsers = useServiceUserTable();
  const localProductBatches = useProductBatchTable();
  const localTaxRates = useTaxRateTable();
  const sales = useBillingSales();

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
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const settings = auth.session?.organization?.settings;
  const autoRefreshEnabled = settings?.autoRefresh === true || settings?.autoRefreshEnabled === true;
  const autoRefreshSeconds = Math.max(15, Number(settings?.autoRefreshIntervalSeconds ?? 60));
  useEffect(() => {
    if (!autoRefreshEnabled || !ready || !local.database) return;
    const timer = setInterval(() => {
      if (running.current || !local.database) return;
      void refreshRef.current().catch(() => undefined);
    }, autoRefreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshSeconds, local.database, ready]);
  const initialRefreshKey = useRef<string | undefined>(undefined);
  const attemptedBootstrap = useRef(false);
  useEffect(() => {
    const key = query.data?.key;
    if (!ready || !key || !local.database || initialRefreshKey.current === key) return;
    initialRefreshKey.current = key;
    if (attemptedBootstrap.current) return;
    void local.database
      .collection('sync_state')
      .list({ includeDeleted: true })
      .then((states) => {
        const loaded = new Set(
          states.map((state) =>
            String((state.payload as { collection?: string }).collection ?? state.remoteId),
          ),
        );
        const required = ['products', 'customers', 'payment_methods', 'tax_rates'];
        if (currentMode === 'pharmacy') required.push('product_batches');
        if (currentMode === 'service') required.push('service_users');
        const hasBootstrap = required.every((collection) => loaded.has(collection));
        if (!hasBootstrap) {
          attemptedBootstrap.current = true;
          running.current = true;
          return billingApi
            .refresh(undefined, local.database, true)
            .then(() => queryClient.invalidateQueries({ queryKey: ['billing-cache'] }))
            .finally(() => {
              running.current = false;
            });
        }
      })
      .catch(() => undefined);
  }, [currentMode, local.database, query.data?.key, queryClient, ready]);
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
    localProducts.data,
    localServiceUsers.data,
    localTaxRates.data,
    query.data,
    ready,
  ]);
  return {
    data,
    error: local.error || auth.error || (error instanceof Error ? error.message : ''),
    busy: query.isFetching || syncMutation.isPending || sales.loading,
    sales,
    refresh,
    reload,
  };
}
