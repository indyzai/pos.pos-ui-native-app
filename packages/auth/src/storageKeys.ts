export type PosApplication = "pos" | "admin";

const namespaces = {
    pos: { local: "indyz", secure: "indyzai" },
    admin: { local: "indyz.admin", secure: "indyzai.admin" },
} as const;

function keysFor(application: PosApplication) {
    const namespace = namespaces[application];
    return {
        auth: {
            accessToken: `${namespace.secure}.access-token`,
            refreshToken: `${namespace.secure}.refresh-token`,
            user: `${namespace.secure}.user`,
            selectedTenant: `${namespace.secure}.selected-tenant`,
            deviceId: `${namespace.secure}.device-id`,
            deviceToken: `${namespace.secure}.device-token`,
            oauthState: `${namespace.secure}.oauth-state`,
            oauthVerifier: `${namespace.secure}.oauth-verifier`,
        },
        apiEnvironment: `${namespace.local}.api-environment.v1`,
        billing: (userId: string, tenantId: string) =>
            `${namespace.local}.billing.v1:${userId}:${tenantId}`,
        orders: (userId: string, tenantId: string) =>
            `${namespace.local}.orders.v1:${userId}:${tenantId}`,
        counterDenominations: (
            tenantId: string,
            counterId: string,
            currencyCode: string,
            scope?: string,
        ) =>
            `${namespace.local}.counter-denominations.v1:${tenantId}:${counterId}:${currencyCode}${scope ? `:${scope}` : ""}`,
    } as const;
}

export const appStorageKeys = {
    pos: keysFor("pos"),
    admin: keysFor("admin"),
} as const;
