import { describe, expect, test } from 'bun:test';
import { getRoleDataManifest } from '@indyzai/pos-database';
import { createScopeKey, normalizePosRole } from '@indyzai/pos-database';
import { schemaSqlForProfile } from '@indyzai/pos-database';

const scope = (role) => ({
  tenantId: 'tenant-1',
  userId: 'user-1',
  role,
  storeIds: ['store-2', 'store-1'],
  deviceId: 'device-1',
  counterId: 'counter-1',
});

describe('role-scoped local database manifest', () => {
  test('cashier receives checkout data but not management or purchasing data', () => {
    const manifest = getRoleDataManifest(scope('cashier'));
    expect(manifest.detailMode).toBe('own-shift');
    expect(manifest.collections.has('products')).toBe(true);
    expect(manifest.collections.has('sales')).toBe(true);
    expect(manifest.collections.has('sync_outbox')).toBe(true);
    expect(manifest.collections.has('stock_counts')).toBe(false);
    expect(manifest.collections.has('purchase_orders')).toBe(false);
  });

  test('manager receives store operations but not administration purchasing data', () => {
    const manifest = getRoleDataManifest(scope('manager'));
    expect(manifest.detailMode).toBe('store');
    expect(manifest.collections.has('stock_counts')).toBe(true);
    expect(manifest.collections.has('transfers')).toBe(true);
    expect(manifest.collections.has('purchase_orders')).toBe(false);
  });

  test('application profiles provision only their required tables', () => {
    const store = getRoleDataManifest({ ...scope('admin'), appProfile: 'store' });
    const admin = getRoleDataManifest({ ...scope('admin'), appProfile: 'admin' });
    expect(store.collections.has('purchase_orders')).toBe(false);
    expect(admin.collections.has('purchase_orders')).toBe(true);

    const sql =
      'CREATE TABLE `products` (`id` text);--> statement-breakpoint' +
      'CREATE TABLE `purchase_orders` (`id` text);';
    expect(schemaSqlForProfile(sql, 'store')).toContain('products');
    expect(schemaSqlForProfile(sql, 'store')).not.toContain('purchase_orders');
  });

  test('admin receives purchasing data', () => {
    const manifest = getRoleDataManifest(scope('admin'));
    expect(manifest.detailMode).toBe('assigned-stores');
    expect(manifest.collections.has('purchase_orders')).toBe(true);
    expect(manifest.collections.has('goods_receipts')).toBe(true);
  });

  test('owner and superadmin default to on-demand details', () => {
    expect(getRoleDataManifest(scope('owner')).detailMode).toBe('on-demand');
    expect(getRoleDataManifest(scope('superadmin')).detailMode).toBe('on-demand');
  });

  test('unknown server roles are least-privilege cashier roles', () => {
    expect(normalizePosRole('unknown')).toBe('cashier');
    expect(normalizePosRole(' MANAGER ')).toBe('manager');
  });

  test('scope keys are deterministic and isolate role, tenant, user, and device', () => {
    const first = createScopeKey(scope('cashier'));
    const reordered = createScopeKey({ ...scope('cashier'), storeIds: ['store-1', 'store-2'] });
    expect(first).toBe(reordered);
    expect(createScopeKey(scope('manager'))).not.toBe(first);
    expect(createScopeKey({ ...scope('cashier'), tenantId: 'tenant-2' })).not.toBe(first);
  });
});
