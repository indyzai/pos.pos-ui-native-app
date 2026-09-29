import 'fake-indexeddb/auto';
import { expect, test } from 'bun:test';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import { createScopeKey } from '@indyzai/pos-database';
import { projectOrganization } from '@indyzai/feature-organization/projectOrganization';
import {
  readWebOrganization,
  writeWebOrganization,
} from '@indyzai/feature-organization/webOrganizationTable';

test('browser authentication organization cache persists in its local table', async () => {
  const id = `web-organization-${crypto.randomUUID()}`;
  expect(await readWebOrganization(id)).toBeNull();
  await writeWebOrganization(id, JSON.stringify({ id: 'tenant', name: 'Corner Shop' }));
  expect(JSON.parse(await readWebOrganization(id)).name).toBe('Corner Shop');
});

test('initial organization data is stored locally without replacing edited settings', async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const name = `organization-projection-${crypto.randomUUID()}`;
  const scope = {
    tenantId: 'tenant',
    userId: 'user',
    role: 'cashier',
    storeIds: ['branch'],
    deviceId: 'device',
  };
  const database = new IndexedDbLocalDatabase(scope, name);
  await database.initialize();
  try {
    const organization = {
      id: 'tenant',
      name: 'Corner Shop',
      settings: { businessType: 'retail', currency: 'INR', features: { customers: true } },
      branches: [{ id: 'branch', name: 'Main', counters: [{ id: 'counter', name: 'Front' }] }],
      activeSession: { id: 'shift', counterId: 'counter', branchId: 'branch', status: 'OPEN' },
    };
    await projectOrganization(database, organization);
    expect((await database.collection('organizations').list())[0].payload.name).toBe('Corner Shop');
    expect((await database.collection('stores').list())[0].payload.name).toBe('Main');
    expect((await database.collection('counters').list())[0].payload.branchId).toBe('branch');
    expect(await database.collection('shifts').list()).toHaveLength(1);

    const id = `${createScopeKey(scope)}:app_settings:business`;
    const settings = database.collection('app_settings');
    expect((await settings.get(id)).payload.values).toMatchObject({ currency: 'INR', customers: true });
    const current = await settings.get(id);
    await settings.put({ ...current, payload: { id, values: { currency: 'USD' } }, syncStatus: 'PENDING' });
    await projectOrganization(database, { ...organization, activeSession: null });
    expect((await settings.get(id)).payload.values.currency).toBe('USD');
    expect((await database.collection('shifts').list())[0].payload.status).toBe('CLOSED');
  } finally {
    await database.close();
    await Dexie.delete(name);
  }
});
