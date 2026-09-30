import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'expo-router';
import { createScopeKey } from '@indyzai/pos-database';
import { useBackgroundRefresh } from '@indyzai/pos-ui-native';
import { printerConfigurationApi } from '../../printing/printerConfigurationApi';
import { getNetworkStatusSnapshot } from '@indyzai/pos-ui-native';
import { billingApi, fallbackPaymentMethods, type BillingCache } from '../billingApi';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { printingApi } from '../../printing/printingApi';
import { OfflineTableName, useAppOfflineEntity } from '../../../hooks/useAppOfflineEntity';
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

function useBillingEntity<T>(tableName: OfflineTableName) {
  const entity = useAppOfflineEntity<T, { payload: T; syncStatus: string }>({
    tableName,
    listSelector: (record) => ({ payload: record.payload, syncStatus: record.syncStatus }),
    pageSize: 100,
  });
  useEffect(() => {
    if (!entity.loading && !entity.loadingMore && entity.localHasMore) void entity.loadMore();
  }, [entity.loading, entity.loadingMore, entity.localHasMore, entity.loadMore]);
  return entity;
}

export function useBillingData(businessTypeOverride?: BillingMode) {
  const pathname = usePathname();
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
  const localProducts = useBillingEntity<Product>(OfflineTableName.Products);
  const localCustomers = useBillingEntity<Customer>(OfflineTableName.Customers);
  const localPaymentMethods = useBillingEntity<BillingPaymentMethod>(OfflineTableName.PaymentMethods);
  const localServiceUsers = useBillingEntity<ServiceUser>(OfflineTableName.ServiceUsers);
  const localProductBatches = useBillingEntity<ProductBatch>(OfflineTableName.ProductBatches);
  const localTaxRates = useBillingEntity<BillingTaxRate>(OfflineTableName.TaxRates);
  const sales = useBillingSales();

  const syncMutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (signal?: AbortSignal) => {
      await billingApi.sync(signal);
      await printingApi.syncPending();
      await billingApi.refresh(signal, local.database);
    },
  });
  const reload = async () => {
    await Promise.all([
      localProducts.refresh(),
      localCustomers.refresh(),
      localPaymentMethods.refresh(),
      localServiceUsers.refresh(),
      localProductBatches.refresh(),
      localTaxRates.refresh(),
      sales.reload(),
    ]);
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
      // The mutation retains its error for the billing status UI.
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
  const error = syncMutation.error;
  const data = useMemo(() => {
    if (!ready || !userId || !tenantId) return undefined;
    return {
      key: appStorageKeys.pos.billing(userId, tenantId),
      cache: {
        products: localProducts.items
          .map((record) => record.payload)
          .filter((product) => product.categoryType !== 'SCRAP'),
        customers: localCustomers.items
          .map((record) => record.payload)
          .filter((customer) => customer.type === 'CUSTOMER'),
        paymentMethods: localPaymentMethods.items.length
          ? localPaymentMethods.items.map((record) => record.payload)
          : fallbackPaymentMethods,
        serviceUsers:
          currentMode === 'service' ? localServiceUsers.items.map((record) => record.payload) : [],
        productBatches:
          currentMode === 'pharmacy' ? localProductBatches.items.map((record) => record.payload) : [],
        taxRates: localTaxRates.items.map((record) => record.payload),
        session: (auth.session?.organization?.activeSession ?? null) as BillingCache['session'],
        queue: sales.data
          .filter((record) => ['PENDING', 'RUNNING', 'FAILED'].includes(record.syncStatus))
          .map((record) => record.payload),
      } satisfies BillingCache,
    };
  }, [
    currentMode,
    localCustomers.items,
    localPaymentMethods.items,
    localProductBatches.items,
    localProducts.items,
    localServiceUsers.items,
    localTaxRates.items,
    sales.data,
    auth.session?.organization?.activeSession,
    userId,
    tenantId,
    ready,
  ]);
  return {
    data,
    error:
      local.error ||
      auth.error ||
      localProducts.error?.message ||
      (error instanceof Error ? error.message : ''),
    busy: syncMutation.isPending || localProducts.loading || sales.loading,
    sales,
    refresh,
    reload,
  };
}
