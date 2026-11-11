import React from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, mock, test } from 'bun:test';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const tables = {
  Products: 'products',
  Customers: 'customers',
  PaymentMethods: 'payment_methods',
  ServiceUsers: 'service_users',
  ProductBatches: 'product_batches',
  TaxRates: 'tax_rates',
};
const rows = Object.fromEntries(
  Object.values(tables).map((table) => [
    table,
    {
      items: [],
      loading: false,
      loadingMore: false,
      localHasMore: false,
      refresh: async () => {},
    },
  ]),
);
const database = { scope: { tenantId: 'tenant', userId: 'user' } };
const local = { status: 'ready', database };
const auth = {
  initializing: false,
  session: {
    user: { id: 'user' },
    tenant: { id: 'tenant' },
    organization: { settings: { businessType: 'RETAIL' } },
  },
};
const sales = { data: [], loading: false, reload: async () => {} };
let sync = async () => {};
mock.module('expo-router', () => ({ usePathname: () => '/billing' }));
mock.module('@indyzai/pos-auth/session', () => ({ useAuthSession: () => auth }));
mock.module('@indyzai/pos-database', () => ({
  createScopeKey: (scope) => `${scope.tenantId}:${scope.userId}`,
}));
mock.module('@indyzai/pos-database/react', () => ({ useLocalDatabase: () => local }));
mock.module('@indyzai/pos-ui-native', () => ({ useBackgroundRefresh: () => {} }));
mock.module('../../../src/hooks/useAppOfflineEntity', () => ({
  OfflineTableName: tables,
  useAppOfflineEntity: ({ tableName }) => rows[tableName],
}));
mock.module('../../../src/features/billing/hooks/useBillingSales', () => ({ useBillingSales: () => sales }));
mock.module('../../../src/features/billing/billingApi', () => ({
  billingApi: { sync: (...args) => sync(...args), refresh: async () => {} },
  fallbackPaymentMethods: [],
}));
mock.module('../../../src/features/printing/printingApi', () => ({
  printingApi: { syncPending: async () => {} },
}));
mock.module('../../../src/features/printing/printerConfigurationApi', () => ({
  printerConfigurationApi: { refresh: async () => {} },
}));
const { useBillingData } = await import('../../../src/features/billing/hooks/useBillingData');

test('initial billing reads block once, while refresh, failures and sales pagination keep cached billing visible', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let billing, view, completeSync;
  function Screen() {
    billing = useBillingData();
    return null;
  }
  const render = () => (
    <QueryClientProvider client={client}>
      <Screen />
    </QueryClientProvider>
  );
  rows.products.loading = true;
  await act(async () => {
    view = create(render());
  });
  expect(billing.initialLoading).toBe(true);
  rows.products.loading = false;
  // An empty hydrated catalog is still ready; refresh must not reopen the initial loader.
  await act(async () => {
    view.update(render());
  });
  expect(billing.initialLoading).toBe(false);
  sync = () =>
    new Promise((resolve) => {
      completeSync = resolve;
    });
  let refresh;
  await act(async () => {
    refresh = billing.refresh();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(billing.busy).toBe(true);
  expect(billing.initialLoading).toBe(false);
  expect(billing.data.cache.products).toEqual([]);
  await act(async () => {
    completeSync();
    await refresh;
  });
  sales.loading = true;
  await act(async () => {
    view.update(render());
  });
  expect(billing.busy).toBe(true);
  expect(billing.initialLoading).toBe(false);
  sales.loading = false;
  sync = async () => {
    throw new Error('Connection lost');
  };
  await act(async () => {
    await billing.refresh();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(billing.error).toBe('Connection lost');
  expect(billing.initialLoading).toBe(false);
  local.status = 'initializing';
  await act(async () => {
    view.update(render());
  });
  expect(billing.initialLoading).toBe(true);
  expect(billing.data).toBeUndefined();
  await act(async () => {
    view.unmount();
  });
  client.clear();
});
