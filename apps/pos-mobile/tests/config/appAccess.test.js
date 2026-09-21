import { describe, expect, test } from 'bun:test';
import { canAccessApp, canPerformManagerActions } from '../../src/config/appAccess.ts';

describe('POS app access', () => {
  test('accepts all recognized business users', () => {
    expect(canAccessApp('cashier')).toBe(true);
    expect(canAccessApp('MANAGER')).toBe(true);
    expect(canAccessApp('member', 'cashier')).toBe(true);
    expect(canAccessApp('member', 'ROLE_MANAGER')).toBe(true);
    expect(canAccessApp('member', 'user')).toBe(true);
    expect(canAccessApp('guest')).toBe(true);
    expect(canAccessApp('owner')).toBe(true);
  });

  test('rejects unknown roles', () => {
    expect(canAccessApp('unexpected-role')).toBe(false);
  });

  test('limits elevated actions to manager-level roles', () => {
    expect(canPerformManagerActions('member', 'user')).toBe(false);
    expect(canPerformManagerActions('cashier')).toBe(false);
    expect(canPerformManagerActions('manager')).toBe(true);
    expect(canPerformManagerActions('member', 'ROLE_MANAGER')).toBe(true);
    expect(canPerformManagerActions('owner')).toBe(true);
  });
});
