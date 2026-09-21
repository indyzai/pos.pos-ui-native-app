import { canAccessAdminApp } from '@indyzai/pos-permissions';

export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
    return canAccessAdminApp(tenantRole, accountRole);
}
