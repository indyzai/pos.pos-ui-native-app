import { expect, test } from 'bun:test';
import { hasEntitlement } from '../../../../packages/permissions/src';

test('cashiers can access stock counts without manager edit permissions', () => {
    expect(hasEntitlement('inventory.reconcile', 'cashier', 'cashier', 'pos')).toBe(true);
    expect(hasEntitlement('inventory.edit', 'cashier', 'cashier', 'pos')).toBe(false);
});

test('POS caps administrative roles at manager permissions', () => {
    expect(hasEntitlement('inventory.reconcile', 'admin', 'admin', 'pos')).toBe(true);
    expect(hasEntitlement('pricing.edit', 'admin', 'admin', 'pos')).toBe(false);
    expect(hasEntitlement('purchases.edit', 'admin', 'admin', 'pos')).toBe(false);
});

test('Admin exposes elevated inventory and purchase entitlements', () => {
    expect(hasEntitlement('pricing.edit', 'admin', 'admin', 'admin')).toBe(true);
    expect(hasEntitlement('purchases.edit', 'owner', 'user', 'admin')).toBe(true);
});
