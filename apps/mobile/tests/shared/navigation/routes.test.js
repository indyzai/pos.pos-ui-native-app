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
