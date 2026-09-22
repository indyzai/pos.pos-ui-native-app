import { useMemo } from "react";
import {
    resolvePermissions,
    type AppSurface,
    type Entitlement,
    type PermissionPolicy,
} from "@indyzai/pos-permissions";
import { useAuthSession } from "./createAuthSession";

export function usePermissions(surface: AppSurface) {
    const { session } = useAuthSession();
    const permissions = useMemo(
        () =>
            resolvePermissions(
                session?.tenant.role,
                session?.user.role,
                surface,
                (session?.organization?.settings?.permissionPolicy ??
                    {}) as PermissionPolicy,
            ),
        [session, surface],
    );
    return {
        permissions,
        can: (permission: Entitlement) => permissions.has(permission),
    };
}
