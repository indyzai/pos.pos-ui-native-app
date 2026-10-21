import { describe, expect, test } from 'bun:test';
import { permitsManagerMenu, resolveStoreAccessRole } from '../../../src/shared/navigation/access';

describe('POS role navigation', () => {
  test('cashiers receive only daily checkout menus', () => {
    expect(permitsManagerMenu(resolveStoreAccessRole('cashier'))).toBe(false);
  });

  test('higher access roles are capped at manager inside POS', () => {
    for (const role of ['manager', 'admin', 'owner', 'superadmin']) {
      expect(resolveStoreAccessRole(role)).toBe('manager');
    }
    expect(permitsManagerMenu(resolveStoreAccessRole('owner'))).toBe(true);
  });
});

test('cashier tenant membership takes precedence over an elevated account role', () => {
  for (const accountRole of ['admin', 'owner', 'superadmin']) {
    expect(resolveStoreAccessRole('cashier', accountRole)).toBe('cashier');
    expect(permitsManagerMenu(resolveStoreAccessRole('cashier', accountRole))).toBe(false);
  }
});
