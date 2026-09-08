import { beforeEach, expect, mock, test } from 'bun:test';
const storage = new Map();
let tenant = '1';
let failWrite = false;
const clone = (value) => structuredClone(value);
mock.module('../../../src/features/billing/data/billingRepository', () => ({
  readBillingSnapshot: async (key) => clone(storage.get(key) ?? { products: [], session: null, queue: [] }),
  writeBillingSnapshot: async (key, value) => {
    if (failWrite) throw new Error('Disk full');
    storage.set(key, clone(value));
  },
}));
mock.module('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
mock.module('../../../src/features/auth/authApi', () => ({
  authApi: {
    getStoredUser: async () => ({ id: 'user' }),
    getSessionUser: async () => ({ id: 'user' }),
    getSelectedTenant: async () => ({ id: tenant }),
    getAccessToken: async () => 'test-token',
  },
}));
mock.module('../../../src/features/auth/AuthSessionContext', () => ({
  getActiveAuthSession: () => ({
    user: { id: 'user' },
    tenant: { id: tenant },
    token: 'test-token',
    organization: { activeSession: { id: '2', counterId: '3', status: 'OPEN' } },
  }),
}));
const { billingApi } = await import('../../../src/features/billing/billingApi');
const key = 'indyz.billing.v1:user:1';
const items = [{ id: '42', price: 10, quantity: 2, taxRate: 5 }];
beforeEach(() => {
  storage.clear();
  tenant = '1';
  failWrite = false;
  process.env.EXPO_PUBLIC_POS_API_URL = 'https://example.test/graphql';
  storage.set(key, { products: [], session: { id: '2', counterId: '3', status: 'OPEN' }, queue: [] });
});
test('concurrent sales are retained', async () => {
  await Promise.all([billingApi.checkout(key, items, 'Cash'), billingApi.checkout(key, items, 'Cash')]);
  const { cache } = await billingApi.load();
  expect(cache.queue).toHaveLength(2);
  expect(cache.queue[0].input.totalAmount).toBe(21);
  expect(cache.queue[0].id).not.toBe(cache.queue[1].id);
});
test('failed upload retains sale and reuses offlineId', async () => {
  const id = await billingApi.checkout(key, items, 'Cash');
  globalThis.fetch = async () => {
    throw new Error('Offline');
  };
  await expect(billingApi.sync()).rejects.toThrow('Offline');
  expect((await billingApi.load()).cache.queue[0].id).toBe(id);
  globalThis.fetch = async (_url, options) => {
    expect(JSON.parse(options.body).variables.newBillData.offlineId).toBe(id);
    return { ok: true, json: async () => ({ data: { saveBill: { id: '99' } } }) };
  };
  await billingApi.sync();
  expect((await billingApi.load()).cache.queue).toHaveLength(0);
});
test('storage failure and business switch reject checkout', async () => {
  failWrite = true;
  await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Disk full');
  failWrite = false;
  tenant = 'other';
  await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Business changed');
  expect((await billingApi.load()).cache.queue).toHaveLength(0);
});

test('catalog refresh maps and persists products for offline billing', async () => {
  globalThis.fetch = async (_url, options) => {
    const query = JSON.parse(options.body).query;
    if (query.includes('query Catalog')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            products: [
              {
                id: 42,
                name: 'Offline tea',
                price: 20,
                quantity: 7,
                barcode: '8901000000042',
                category: { name: 'Beverages' },
                tax: { percentage: 5 },
              },
            ],
          },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          organization: {
            id: '1',
            name: 'Test business',
            config: {},
            activeSession: { id: '2', counterId: '3', status: 'OPEN' },
          },
        },
      }),
    };
  };
  await billingApi.refresh();
  const { cache } = await billingApi.load();
  expect(cache.products).toEqual([
    expect.objectContaining({ id: '42', name: 'Offline tea', category: 'Beverages', stock: 7, taxRate: 5 }),
  ]);
});
