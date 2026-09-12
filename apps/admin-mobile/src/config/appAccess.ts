const storeAppRoles = new Set(['cashier', 'manager']);
const adminAccountRoles = new Set(['admin', 'superadmin']);
const adminTenantRoles = new Set(['owner', 'admin', 'member', 'guest']);

const normalizeRole = (role: unknown) =>
    String(role ?? '')
        .trim()
        .toLowerCase()
        .replaceAll('-', '')
        .replaceAll('_', '');

/**
 * The auth API has two role domains: account roles and tenant membership roles.
 * Store-only cashier/manager identities belong in the POS app; all other valid
 * tenant users and platform administrators belong in this administration app.
 */
export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
    const tenant = normalizeRole(tenantRole);
    const account = normalizeRole(accountRole);
    if (adminAccountRoles.has(account)) return true;
    return !storeAppRoles.has(tenant) && adminTenantRoles.has(tenant);
}
