import { posRoles, type PosRole } from '@indyzai/pos-database';

export const allowedAppRoles: readonly PosRole[] = ['cashier', 'manager', 'admin', 'owner', 'superadmin'];
const tenantUserRoles = new Set(['cashier', 'manager', 'admin', 'owner', 'superadmin', 'member', 'guest']);
const accountUserRoles = new Set(['cashier', 'manager', 'admin', 'owner', 'superadmin', 'user', 'member']);

const normalizeRole = (role: unknown) =>
  String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/^role[_:-]?/, '') as PosRole;

export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
  const tenant = normalizeRole(tenantRole);
  const account = normalizeRole(accountRole);
  return tenantUserRoles.has(tenant) || accountUserRoles.has(account);
}

export function canPerformManagerActions(tenantRole: unknown, accountRole?: unknown): boolean {
  const elevated = new Set(['manager', 'admin', 'owner', 'superadmin']);
  return elevated.has(normalizeRole(tenantRole)) || elevated.has(normalizeRole(accountRole));
}
