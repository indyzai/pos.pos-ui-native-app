const storeAppRoles = new Set(["cashier", "manager"]);
const adminAccountRoles = new Set(["admin", "superadmin"]);
const adminTenantRoles = new Set(["owner", "admin", "member", "guest"]);
const tenantUserRoles = new Set([
    "cashier",
    "manager",
    "admin",
    "owner",
    "superadmin",
    "member",
    "guest",
]);
const accountUserRoles = new Set([
    "cashier",
    "manager",
    "admin",
    "owner",
    "superadmin",
    "user",
    "member",
]);

export type AppSurface = "pos" | "admin";
export type Entitlement =
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

const cashierEntitlements: readonly Entitlement[] = ["inventory.view"];
const managerEntitlements: readonly Entitlement[] = [
    ...cashierEntitlements,
    "manager.actions",
    "inventory.edit",
    "inventory.reconcile",
    "purchases.view",
    "purchases.create",
    "purchases.split_item",
    "purchases.ai_import",
];
const adminEntitlements: readonly Entitlement[] = [
    ...managerEntitlements,
    "pricing.edit",
    "purchases.edit",
];

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
    return tenantUserRoles.has(tenant) || accountUserRoles.has(account);
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
    const effective =
        roles
            .sort((a, b) => rank(a) - rank(b))
            .find((role) => roleEntitlementMap[role]) ?? "cashier";
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
    return entitlementsForRole(tenantRole, accountRole, surface).has(
        entitlement,
    );
}
