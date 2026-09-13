const storeAppRoles = new Set(['cashier', 'manager']);
const adminAccountRoles = new Set(['admin', 'superadmin']);
const adminTenantRoles = new Set(['owner', 'admin', 'member', 'guest']);
const tenantUserRoles = new Set(['cashier', 'manager', 'admin', 'owner', 'superadmin', 'member', 'guest']);
const accountUserRoles = new Set(['cashier', 'manager', 'admin', 'owner', 'superadmin', 'user', 'member']);
const elevatedRoles = new Set(['manager', 'admin', 'owner', 'superadmin']);

export function normalizeRole(role: unknown): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/^role[_:-]?/, '')
    .replaceAll('-', '')
    .replaceAll('_', '');
}

export function canAccessStoreApp(tenantRole: unknown, accountRole?: unknown): boolean {
  const tenant = normalizeRole(tenantRole);
  const account = normalizeRole(accountRole);
  return tenantUserRoles.has(tenant) || accountUserRoles.has(account);
}

export function canAccessAdminApp(tenantRole: unknown, accountRole?: unknown): boolean {
  const tenant = normalizeRole(tenantRole);
  const account = normalizeRole(accountRole);
  if (adminAccountRoles.has(account)) return true;
  return !storeAppRoles.has(tenant) && adminTenantRoles.has(tenant);
}

export function canPerformManagerActions(tenantRole: unknown, accountRole?: unknown): boolean {
  const tenant = normalizeRole(tenantRole);
  const account = normalizeRole(accountRole);
  return elevatedRoles.has(tenant) || elevatedRoles.has(account);
}
