const waybillRoles = new Set(['admin', 'owner', 'superadmin', 'manager']);

export function canManageWaybills(role: unknown): boolean {
    return waybillRoles.has(
        String(role || '')
            .trim()
            .toLowerCase(),
    );
}
