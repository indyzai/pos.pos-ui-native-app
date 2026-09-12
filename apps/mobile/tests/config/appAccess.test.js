import { describe, expect, test } from 'bun:test';
import { canAccessApp } from '../../src/config/appAccess.ts';

describe('cashier and manager app access', () => {
  test('accepts cashier and manager roles', () => {
    expect(canAccessApp('cashier')).toBe(true);
    expect(canAccessApp('MANAGER')).toBe(true);
  });

  test('rejects administrative and unknown roles', () => {
    expect(canAccessApp('admin')).toBe(false);
    expect(canAccessApp('superadmin')).toBe(false);
    expect(canAccessApp('unexpected-role')).toBe(false);
  });
});
