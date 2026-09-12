const scrapRoles = new Set(['admin', 'owner', 'superadmin', 'manager']);

export function canManageScrap(role?: string): boolean {
    return scrapRoles.has(String(role || '').toLowerCase());
}
