import { canAccessAdminApp } from '@indyzai/pos-permissions';

export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
    console.log('Checking app access', tenantRole, accountRole);
    return canAccessAdminApp(tenantRole, accountRole);
}
