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
import { createLogger } from "@indyzai/pos-utils";
import { AuthBranding } from "./AuthBranding";
import { useBackgroundRefresh } from "@indyzai/pos-ui-native";

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
        handler: (token?: string) => Promise<void>,
    ) => () => void;
    loadOrganizationDetails: (
        token: string,
        tenantId: string,
        signal?: AbortSignal,
    ) => Promise<AuthOrganizationDetails>;
    loadCachedOrganizationDetails?: (
        userId: string,
        tenantId: string,
    ) => Promise<AuthOrganizationDetails | null>;
    saveCachedOrganizationDetails?: (
        userId: string,
        tenantId: string,
        value: AuthOrganizationDetails,
    ) => Promise<void>;
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
            const currentToken = await authApi.getAccessToken();
            if (token && currentToken && currentToken !== token) return;
            pending = (async () => {
                generation.current++;
                activeSession = null;
                setSession(null);
                setUser(null);
                setAuthenticated(false);
                setInitializing(false);
                setError("Session expired. Please sign in again.");
                try {
                    await authApi.logout();
                } catch {
                    // Ignore logout failure during session invalidation
                }
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
        setInitializing(!activeSession);
        try {
            let [profile, token] = await Promise.all([
                authApi.getStoredUser(),
                authApi.getAccessToken(),
            ]);
            if (current !== generation.current) return;
            if (token && !profile?.tenants?.length) {
                // First-time identity hydration needs connectivity, but never holds the splash.
                setInitializing(false);
                profile = await authApi.getSessionUser();
                if (current !== generation.current) return;
            }
            setUser(profile);
            // Resolve membership from the profile just returned by /users/me.
            // Storage supplies only the preferred ID, never a second user snapshot.
            const tenant = await authApi.getSelectedTenant(profile);
            if (current !== generation.current) return;
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
            sessionLogger.info("identity have app access", {
                hasAppAccess: tenant
                    ? canAccessApp(tenant.role, profile?.role)
                    : false,
                tenant,
                profile,
            });
            if (tenant && !canAccessApp(tenant.role, profile?.role)) {
                activeSession = null;
                setSession(null);
                setUser(null);
                setAuthenticated(false);
                setError(configuration.accessDeniedMessage);
                return;
            }
            const next: AuthSession | null =
                profile && token && tenant
                    ? { user: profile, token, tenant, organization: null }
                    : null;

            if (next && configuration.loadCachedOrganizationDetails) {
                next.organization = await configuration
                    .loadCachedOrganizationDetails(
                        String(next.user.id),
                        String(next.tenant.id),
                    )
                    .catch(() => null);
                if (current !== generation.current) return;
            }
            activeSession = next;
            setSession(next);
            setAuthenticated(Boolean(next));
            setError("");
            setInitializing(false);
            if (!next && (await authApi.getAccessToken())) {
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
        return () => {
            generation.current++;
        };
    }, []);
    useBackgroundRefresh(
        session
            ? `organization:${session.user.id}:${session.tenant.id}:${generation.current}`
            : undefined,
        async (signal) => {
            const next = activeSession;
            const current = generation.current;
            if (!next) return;
            const organization = await loadOrganizationDetails(
                next.token,
                String(next.tenant.id),
                signal,
            );
            if (current !== generation.current || signal.aborted) return;
            await configuration.saveCachedOrganizationDetails?.(
                String(next.user.id),
                String(next.tenant.id),
                organization,
            );
            if (current !== generation.current || signal.aborted) return;
            activeSession = { ...next, organization };
            setSession(activeSession);
        },
    );
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
            <AuthBranding
                fullScreen
                title="Welcome back"
                subtitle="Your business is ready wherever the day takes you."
            />
            <View style={[s.loaderCard, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={c.primary} />
                <View style={s.loaderCopy}>
                    <Text style={[s.loaderTitle, { color: c.primary }]}>
                        Opening your workspace
                    </Text>
                    <Text style={[s.loaderText, { color: c.textSecondary }]}>
                        Loading your secure local data for a smooth,
                        offline-ready start.
                    </Text>
                </View>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    loader: {
        flex: 1,
        overflow: "hidden",
    },
    loaderCard: {
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 46,
        maxWidth: 520,
        alignSelf: "center",
        minHeight: 92,
        borderRadius: 24,
        paddingHorizontal: 22,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        shadowColor: "#050A18",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 24,
        elevation: 12,
    },
    loaderCopy: { flex: 1 },
    loaderTitle: { fontSize: 16, fontWeight: "900" },
    loaderText: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "600",
    },
});
