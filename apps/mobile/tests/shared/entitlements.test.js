import { expect, test } from 'bun:test';
import { hasEntitlement } from '../../../../packages/auth/src/appAccess';

test('POS caps an administrator at manager entitlements', () => {
  expect(hasEntitlement('inventory.reconcile', 'admin', 'admin', 'pos')).toBe(true);
  expect(hasEntitlement('pricing.edit', 'admin', 'admin', 'pos')).toBe(false);
  expect(hasEntitlement('purchases.edit', 'admin', 'admin', 'pos')).toBe(false);
});

test('Admin exposes elevated inventory and purchase entitlements', () => {
  expect(hasEntitlement('pricing.edit', 'admin', 'admin', 'admin')).toBe(true);
  expect(hasEntitlement('purchases.edit', 'owner', 'user', 'admin')).toBe(true);
});
