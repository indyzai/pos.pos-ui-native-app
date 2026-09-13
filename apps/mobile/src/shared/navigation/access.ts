export type StoreAccessRole = 'cashier' | 'manager';

export function resolveStoreAccessRole(tenantRole: unknown, accountRole?: unknown): StoreAccessRole {
  const elevated = new Set(['manager', 'admin', 'owner', 'superadmin']);
  const normalize = (value: unknown) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/^role[_:-]?/, '');
  return elevated.has(normalize(tenantRole)) || elevated.has(normalize(accountRole)) ? 'manager' : 'cashier';
}

export const permitsManagerMenu = (role: StoreAccessRole) => role === 'manager';
