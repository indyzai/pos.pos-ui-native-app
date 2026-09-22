import { type PosRole } from '@indyzai/pos-database';
import { canAccessStoreApp, canPerformManagerActions as checkManagerActions } from '@indyzai/pos-permissions';

export const allowedAppRoles: readonly PosRole[] = ['cashier', 'manager'];

export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
    console.log('Checking app access', tenantRole, accountRole);
    return canAccessStoreApp(tenantRole, accountRole);
}

export function canPerformManagerActions(tenantRole: unknown, accountRole?: unknown): boolean {
    return checkManagerActions(tenantRole, accountRole);
}
