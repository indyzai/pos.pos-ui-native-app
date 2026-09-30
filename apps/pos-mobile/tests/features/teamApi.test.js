import { afterEach, expect, mock, test } from 'bun:test';
import { setActiveDatabase } from '@indyzai/pos-database';

mock.module('@indyzai/pos-database/client', () => ({
  hasNativeDatabase: false,
  getDatabase: () => undefined,
}));
mock.module('@indyzai/pos-database/migrations', () => ({ initializeDatabase: () => undefined }));
const { createTeamApi } = await import('@indyzai/feature-organization/team-api');

const scope = {
  tenantId: 'tenant',
  userId: 'user',
  role: 'manager',
  storeIds: ['store'],
  deviceId: 'device',
};
function database() {
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

test('team refresh persists members and direct staff creation refreshes the users table', async () => {
  const db = database();
  setActiveDatabase(db);
  const calls = [];
  let members = [{ id: '1', name: 'Manager', email: 'manager@example.com', role: 'manager', isActive: true }];
  const api = createTeamApi({
    getContext: () => ({ database: db, scope: 'scope', tenant: 'tenant', token: 'token' }),
    request: async (_token, _tenant, query, variables) => {
      calls.push({ query, variables });
      if (query.includes('createDeviceUser')) {
        members = [
          ...members,
          {
            id: '2',
            name: 'Cashier',
            phone: '9876543210',
            role: 'cashier',
            isActive: true,
            isDeviceUser: true,
          },
        ];
        return { createDeviceUser: members.at(-1) };
      }
      return { teamMembers: members };
    },
  });
  await api.refresh();
  expect((await db.collection('users').list()).map((row) => row.payload.role)).toEqual(['manager']);
  await api.create({ name: 'Cashier', phone: '9876543210', pin: '1234', role: 'cashier' });
  expect(calls[1].variables).toEqual({
    details: { name: 'Cashier', email: undefined, phone: '9876543210', pin: '1234', role: 'cashier' },
  });
  expect((await db.collection('users').list()).map((row) => row.payload.role).sort()).toEqual([
    'cashier',
    'manager',
  ]);
});
