import { afterEach, expect, mock, test } from 'bun:test';
import { createScopeKey, setActiveDatabase } from '@indyzai/pos-database';

mock.module('@indyzai/pos-database/client', () => ({
  hasNativeDatabase: false,
  getDatabase: () => undefined,
}));
mock.module('@indyzai/pos-database/migrations', () => ({ initializeDatabase: () => undefined }));
const { ordersRepository } = await import('@indyzai/feature-orders/ordersRepository');

const scope = {
  tenantId: 'orders-tenant',
  userId: 'orders-user',
  role: 'cashier',
  storeIds: ['orders-store'],
  deviceId: 'orders-device',
  counterId: 'orders-counter',
};

function localDatabase() {
  const tables = new Map();
  return {
    scope,
    collection(name) {
      const rows = tables.get(name) ?? new Map();
      tables.set(name, rows);
      return {
        list: async () => [...rows.values()],
        get: async (id) => rows.get(id),
        put: async (record) => {
          rows.set(record.id, record);
        },
        replace: async (records) => {
          rows.clear();
          for (const record of records) rows.set(record.id, record);
        },
      };
    },
  };
}

afterEach(() => setActiveDatabase(null));

test('order refresh writes the same scoped table read by the screen', async () => {
  const database = localDatabase();
  setActiveDatabase(database);
  const order = {
    id: '12',
    billId: 'B-12',
    subtotal: 100,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 100,
    status: 'COMPLETED',
    type: 'SALE',
    saleDate: '2026-09-30T10:00:00.000Z',
    items: [],
  };

  await ordersRepository.replaceOrders('legacy-orders-key', [order]);
  expect((await database.collection('orders').list()).map((row) => row.payload)).toEqual([order]);
  expect(await ordersRepository.readOrders('legacy-orders-key')).toEqual([order]);
  expect(
    (await database.collection('sync_state').get(`${createScopeKey(scope)}:sync_state:orders`)).payload
      .collection,
  ).toBe('orders');

  await ordersRepository.replaceOrders('legacy-orders-key', []);
  expect(await ordersRepository.readOrders('legacy-orders-key')).toEqual([]);
});
