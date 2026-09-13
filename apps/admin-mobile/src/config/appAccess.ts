import { canAccessAdminApp } from '@indyzai/pos-auth/access';

export function canAccessApp(tenantRole: unknown, accountRole?: unknown): boolean {
    return canAccessAdminApp(tenantRole, accountRole);
}
