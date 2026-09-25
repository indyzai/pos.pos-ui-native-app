const storeAppRoles = new Set(["cashier", "manager"]);
const adminAccountRoles = new Set(["admin", "owner", "superadmin"]);
const adminTenantRoles = new Set(["owner", "admin", "superadmin"]);

export type AppSurface = "pos" | "admin";
export type Entitlement =
    | Permission
    | "manager.actions"
    | "inventory.view"
    | "inventory.edit"
    | "inventory.reconcile"
    | "pricing.edit"
    | "purchases.view"
    | "purchases.create"
    | "purchases.edit"
    | "purchases.split_item"
    | "purchases.ai_import";

const cashierEntitlements: readonly Entitlement[] = [
    "billing.create",
    "billing.hold",
    "payment.cash",
    "payment.card",
    "payment.upi",
    "scrap.create",
    "service.create",
    "reports.view",
    "inventory.view",
    "inventory.reconcile",
];
const managerEntitlements: readonly Entitlement[] = [
    ...cashierEntitlements,
    "manager.actions",
    "inventory.edit",
    "inventory.reconcile",
    "purchases.view",
    "purchases.create",
    "purchases.split_item",
    "purchases.ai_import",
    "billing.discount",
    "billing.manual_price",
    "billing.void",
    "billing.return",
    "payment.credit",
    "payment.refund",
    "inventory.adjust",
    "inventory.transfer",
    "scrap.value_override",
    "scrap.approve",
    "service.price_override",
    "reports.export",
    "printer.manage",
];
const adminEntitlements: readonly Entitlement[] = [
    ...managerEntitlements,
    "pricing.edit",
    "purchases.edit",
    "users.manage",
    "organization.manage",
    "feature_flags.manage",
];

export const permissions = [
    "billing.create",
    "billing.discount",
    "billing.manual_price",
    "billing.void",
    "billing.hold",
    "billing.return",
    "payment.cash",
    "payment.card",
    "payment.upi",
    "payment.credit",
    "payment.refund",
    "inventory.view",
    "inventory.adjust",
    "inventory.transfer",
    "scrap.create",
    "scrap.value_override",
    "scrap.approve",
    "service.create",
    "service.price_override",
    "reports.view",
    "reports.export",
    "users.manage",
    "organization.manage",
    "feature_flags.manage",
    "printer.manage",
] as const;
export type Permission = (typeof permissions)[number];
export type PermissionOverrides = Partial<Record<Entitlement, boolean>>;

export interface PermissionPolicy {
    global?: PermissionOverrides;
    organization?: PermissionOverrides;
    user?: PermissionOverrides;
}

/** Global denials are a ceiling; organization denials cannot be lifted by a user override. */
export function resolvePermissions(
    tenantRole: unknown,
    accountRole?: unknown,
    surface: AppSurface = "pos",
    policy: PermissionPolicy = {},
): ReadonlySet<Entitlement> {
    const allowed =
        surface === "pos"
            ? canAccessStoreApp(tenantRole, accountRole)
            : canAccessAdminApp(tenantRole, accountRole);
    if (!allowed) return new Set();
    const result = new Set(
        entitlementsForRole(tenantRole, accountRole, surface),
    );
    for (const overrides of [policy.global, policy.organization, policy.user]) {
        for (const [code, enabled] of Object.entries(overrides ?? {})) {
            const permission = code as Entitlement;
            if (enabled === true) result.add(permission);
            if (enabled === false) result.delete(permission);
        }
    }
    for (const overrides of [policy.global, policy.organization]) {
        for (const [code, enabled] of Object.entries(overrides ?? {})) {
            if (enabled === false) result.delete(code as Entitlement);
        }
    }
    if (surface === "pos") {
        for (const permission of result) {
            if (!managerEntitlements.includes(permission))
                result.delete(permission);
        }
    } else {
        result.delete("billing.create");
    }
    return result;
}

export const roleEntitlementMap: Readonly<
    Record<string, readonly Entitlement[]>
> = {
    cashier: cashierEntitlements,
    user: cashierEntitlements,
    guest: cashierEntitlements,
    member: cashierEntitlements,
    manager: managerEntitlements,
    admin: adminEntitlements,
    owner: adminEntitlements,
    superadmin: adminEntitlements,
};

export function normalizeRole(role: unknown): string {
    return String(role ?? "")
        .trim()
        .toLowerCase()
        .replace(/^role[_:-]?/, "")
        .replaceAll("-", "")
        .replaceAll("_", "");
}

export function canAccessStoreApp(
    tenantRole: unknown,
    accountRole?: unknown,
): boolean {
    const tenant = normalizeRole(tenantRole);
    const account = normalizeRole(accountRole);
    if (adminTenantRoles.has(tenant) || adminAccountRoles.has(account))
        return true;
    return storeAppRoles.has(tenant) || storeAppRoles.has(account);
}

export function canAccessAdminApp(
    tenantRole: unknown,
    accountRole?: unknown,
): boolean {
    const tenant = normalizeRole(tenantRole);
    const account = normalizeRole(accountRole);
    if (adminAccountRoles.has(account)) return true;
    return !storeAppRoles.has(tenant) && adminTenantRoles.has(tenant);
}

export function canPerformManagerActions(
    tenantRole: unknown,
    accountRole?: unknown,
): boolean {
    return hasEntitlement("manager.actions", tenantRole, accountRole, "pos");
}

export function entitlementsForRole(
    tenantRole: unknown,
    accountRole?: unknown,
    surface: AppSurface = "pos",
): ReadonlySet<Entitlement> {
    const roles = [normalizeRole(tenantRole), normalizeRole(accountRole)];
    const rank = (role: string) =>
        [
            "superadmin",
            "owner",
            "admin",
            "manager",
            "member",
            "cashier",
            "user",
            "guest",
        ].indexOf(role);
    const effective = roles
        .sort((a, b) => rank(a) - rank(b))
        .find((role) => roleEntitlementMap[role]);
    if (!effective) return new Set();
    const cappedRole =
        surface === "pos" &&
        ["superadmin", "owner", "admin"].includes(effective)
            ? "manager"
            : effective;
    return new Set(roleEntitlementMap[cappedRole] ?? cashierEntitlements);
}

export function hasEntitlement(
    entitlement: Entitlement,
    tenantRole: unknown,
    accountRole?: unknown,
    surface: AppSurface = "pos",
): boolean {
    return resolvePermissions(tenantRole, accountRole, surface).has(
        entitlement,
    );
}
