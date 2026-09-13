import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { billingApi, type BillingCache } from '../billingApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { printingApi } from '../../printing/printingApi';
import {
  payloadsFromRecords,
  useLocalCollection,
  useLocalCustomers,
  useLocalProducts,
} from '@indyzai/pos-database';
import type { LocalRecord } from '@indyzai/pos-database';
import type {
  BillingPaymentMethod,
  BillingTaxRate,
  Customer,
  Product,
  ProductBatch,
  ServiceUser,
} from '../types/billing';
import { resolveBillingMode, type BillingMode } from '../domain/billingMode';

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
  const localProducts = useLocalProducts<LocalRecord<Product>>();
  const localCustomers = useLocalCustomers<LocalRecord<Customer>>();
  const localPaymentMethods = useLocalCollection<LocalRecord<BillingPaymentMethod>>('payment_methods');
  const localServiceUsers = useLocalCollection<LocalRecord<ServiceUser>>('service_users');
  const localProductBatches = useLocalCollection<LocalRecord<ProductBatch>>('product_batches');
  const localTaxRates = useLocalCollection<LocalRecord<BillingTaxRate>>('tax_rates');

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
  useEffect(() => {
    const key = query.data?.key;
    if (!ready || !key || !local.database || initialRefreshKey.current === key) return;
    initialRefreshKey.current = key;
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
        products: payloadsFromRecords(localProducts.records),
        customers: payloadsFromRecords(localCustomers.records),
        paymentMethods: payloadsFromRecords(localPaymentMethods.records),
        serviceUsers: currentMode === 'service' ? payloadsFromRecords(localServiceUsers.records) : [],
        productBatches: currentMode === 'pharmacy' ? payloadsFromRecords(localProductBatches.records) : [],
        taxRates: payloadsFromRecords(localTaxRates.records),
      },
    };
  }, [
    currentMode,
    localCustomers.records,
    localPaymentMethods.records,
    localProductBatches.records,
    localProducts.records,
    localServiceUsers.records,
    localTaxRates.records,
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
