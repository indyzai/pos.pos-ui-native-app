import { entitlementsForRole } from '@indyzai/pos-permissions';
export type StoreAccessRole = 'cashier' | 'manager';

export function resolveStoreAccessRole(tenantRole: unknown, accountRole?: unknown): StoreAccessRole {
  return entitlementsForRole(tenantRole, accountRole, 'pos').has('manager.actions') ? 'manager' : 'cashier';
}

export const permitsManagerMenu = (role: StoreAccessRole) => role === 'manager';
