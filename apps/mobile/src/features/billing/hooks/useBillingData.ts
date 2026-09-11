import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { billingApi, type BillingCache } from '../billingApi';
import { useAuthSession } from '../../auth/AuthSessionContext';
import { useLocalDatabase } from '../../../db/DatabaseProvider';
import { printingApi } from '../../printing/printingApi';
import {
  payloadsFromRecords,
  replaceLocalPayloads,
  useLocalCollection,
  useLocalCustomers,
  useLocalProducts,
} from '../../../db';
import type { LocalRecord } from '../../../db';
import type {
  BillingPaymentMethod,
  BillingTaxRate,
  Customer,
  Product,
  ProductBatch,
  ServiceUser,
} from '../types/billing';

export function useBillingData() {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const [projectionError, setProjectionError] = useState('');
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
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
  const localProducts = useLocalProducts<LocalRecord<Product>>();
  const localCustomers = useLocalCustomers<LocalRecord<Customer>>();
  const localPaymentMethods = useLocalCollection<LocalRecord<BillingPaymentMethod>>('payment_methods');
  const localServiceUsers = useLocalCollection<LocalRecord<ServiceUser>>('service_users');
  const localProductBatches = useLocalCollection<LocalRecord<ProductBatch>>('product_batches');
  const localTaxRates = useLocalCollection<LocalRecord<BillingTaxRate>>('tax_rates');

  useEffect(() => {
    if (!local.database || !query.data) return;
    const { cache } = query.data;
    void Promise.all([
      replaceLocalPayloads(local.database, 'products', cache.products),
      replaceLocalPayloads(local.database, 'customers', cache.customers),
      replaceLocalPayloads(local.database, 'payment_methods', cache.paymentMethods),
      replaceLocalPayloads(local.database, 'service_users', cache.serviceUsers),
      replaceLocalPayloads(local.database, 'product_batches', cache.productBatches),
      replaceLocalPayloads(local.database, 'tax_rates', cache.taxRates),
    ]).then(
      () => setProjectionError(''),
      (reason) =>
        setProjectionError(
          reason instanceof Error ? reason.message : 'Unable to update the local POS database.',
        ),
    );
  }, [local.database, query.data]);
  const syncMutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (signal?: AbortSignal) => {
      await billingApi.sync(signal);
      await printingApi.syncPending();
      await billingApi.refresh(signal);
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
        serviceUsers: payloadsFromRecords(localServiceUsers.records),
        productBatches: payloadsFromRecords(localProductBatches.records),
        taxRates: payloadsFromRecords(localTaxRates.records),
      },
    };
  }, [
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
    error: local.error || auth.error || projectionError || (error instanceof Error ? error.message : ''),
    busy: query.isFetching || syncMutation.isPending,
    refresh,
    reload,
  };
}
