import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { AuthTenant, AuthUser } from "./types";
import type { createAuthApi } from "./createAuthApi";
import { createLogger } from "@indyzai/pos-core";

const sessionLogger = createLogger("Auth:session");

type AuthApi = ReturnType<typeof createAuthApi>;
export type AuthOrganizationDetails = {
    id: string;
    name: string;
    settings: Record<string, unknown>;
    branches: Array<{
        id: string;
        name: string;
        counters: Array<{ id: string; name: string; status?: string }>;
    }>;
    activeSession: {
        id: string;
        counterId: string;
        status: string;
        branchId?: string;
        counterName?: string;
        branchName?: string;
        sessionNumber?: string;
        openedAt?: string;
        openingBalance?: number;
        expectedBalance?: number;
        salesSummary?: {
            cash: number;
            card: number;
            upi: number;
            scrap: number;
            miscIncome: number;
            miscExpense: number;
            totalSales: number;
        };
    } | null;
};
export type AuthSessionConfiguration = {
    authApi: AuthApi;
    setUnauthorizedHandler: (
        handler: (token: string) => Promise<void>,
    ) => () => void;
    loadOrganizationDetails: (
        token: string,
        tenantId: string,
    ) => Promise<AuthOrganizationDetails>;
    canAccessApp: (tenantRole: string, userRole?: string) => boolean;
    accessDeniedMessage: string;
    loaderColors: {
        background: string;
        primary: string;
        textSecondary: string;
    };
};

export type AuthSession = {
    user: AuthUser;
    tenant: AuthTenant;
    token: string;
    organization: AuthOrganizationDetails | null;
};
type AuthSessionValue = {
    user: AuthUser | null;
    authenticated: boolean;
    session: AuthSession | null;
    initializing: boolean;
    error: string;
    refreshSession: () => Promise<void>;
};
const AuthSessionContext = createContext<AuthSessionValue | null>(null);
let activeSession: AuthSession | null = null;

export const getActiveAuthSession = () => activeSession;

export function AuthSessionProvider({
    children,
    configuration,
}: {
    children: ReactNode;
    configuration: AuthSessionConfiguration;
}) {
    const {
        authApi,
        setUnauthorizedHandler,
        loadOrganizationDetails,
        canAccessApp,
    } = configuration;
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [session, setSession] = useState<AuthSession | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState("");
    const generation = useRef(0);
    useEffect(() => {
        let pending: Promise<void> | undefined;
        return setUnauthorizedHandler(async (token) => {
            if (pending) return pending;
            if ((await authApi.getAccessToken()) !== token) return;
            pending = (async () => {
                generation.current++;
                activeSession = null;
                setSession(null);
                setUser(null);
                setAuthenticated(false);
                setInitializing(false);
                setError("Session expired. Please sign in again.");
                await authApi.logout();
            })();
            try {
                await pending;
            } finally {
                pending = undefined;
            }
        });
    }, []);
    const refreshSession = async () => {
        const current = ++generation.current;
        setInitializing(true);
        activeSession = null;
        setSession(null);
        setUser(null);
        setAuthenticated(false);
        try {
            const [profile, token] = await Promise.all([
                authApi.getSessionUser(),
                authApi.getAccessToken(),
            ]);
            if (current !== generation.current) return;
            setUser(profile);
            setAuthenticated(Boolean(profile && token));
            // Resolve membership from the profile just returned by /users/me.
            // Storage supplies only the preferred ID, never a second user snapshot.
            const tenant = await authApi.getSelectedTenant(profile);
            if (current !== generation.current) return;
            if (typeof __DEV__ !== "undefined" && __DEV__)
                sessionLogger.info("Resolved authenticated identity", {
                    hasProfile: Boolean(profile),
                    hasToken: Boolean(token),
                    hasTenant: Boolean(tenant),
                    tenantRole: tenant?.role,
                    accountRole: profile?.role,
                    hasAppAccess: tenant
                        ? canAccessApp(tenant.role, profile?.role)
                        : false,
                });
            if (tenant && !canAccessApp(tenant.role, profile?.role)) {
                setUser(null);
                setAuthenticated(false);
                setError(configuration.accessDeniedMessage);
                return;
            }
            const next: AuthSession | null =
                profile && token && tenant
                    ? { user: profile, token, tenant, organization: null }
                    : null;
            activeSession = next;
            setSession(next);
            setError("");
            if (next) {
                const organization = await loadOrganizationDetails(
                    next.token,
                    String(next.tenant.id),
                );
                if (current !== generation.current) return;
                activeSession = { ...next, organization };
                setSession(activeSession);
            } else if (await authApi.getAccessToken()) {
                setError(
                    "Signed in, but no business profile is available. Retry workspace initialization.",
                );
            }
        } catch (reason) {
            if (current !== generation.current) return;
            // An organization request failure must not discard a valid signed-in identity.
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to initialize your business.",
            );
        } finally {
            if (current === generation.current) setInitializing(false);
        }
    };
    useEffect(() => {
        void refreshSession();
    }, []);
    const value = useMemo(
        () => ({
            user,
            authenticated,
            session,
            initializing,
            error,
            refreshSession,
        }),
        [user, authenticated, session, initializing, error],
    );
    return (
        <AuthSessionContext.Provider value={value}>
            {children}
            {initializing && (
                <View style={StyleSheet.absoluteFill}>
                    <StartupLoader colors={configuration.loaderColors} />
                </View>
            )}
        </AuthSessionContext.Provider>
    );
}

export function useAuthSession() {
    const value = useContext(AuthSessionContext);
    if (!value)
        throw new Error(
            "useAuthSession must be used within AuthSessionProvider",
        );
    return value;
}

function StartupLoader({
    colors: c,
}: {
    colors: AuthSessionConfiguration["loaderColors"];
}) {
    return (
        <View style={[s.loader, { backgroundColor: c.background }]}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={[s.loaderText, { color: c.textSecondary }]}>
                Preparing your workspace…
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
    loader: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    },
    loaderText: { fontSize: 14, fontWeight: "700" },
});
