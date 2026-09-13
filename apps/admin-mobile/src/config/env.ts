export const development = typeof __DEV__ !== 'undefined' && __DEV__;
export const productionApiUrls = {
    pos: 'https://api.indyzai.com/pos/api/graphql',
    posBase: 'https://api.indyzai.com/pos/api',
    auth: 'https://api.indyzai.com/auth/api/v1',
} as const;

function getExpoGoLinkingUri(expoGoLinkingUri?: string): string | undefined {
    if (expoGoLinkingUri) return expoGoLinkingUri;
    try {
        const Constants = require('expo-constants');
        const constants = Constants?.default ?? Constants;
        if (constants?.executionEnvironment === 'storeClient') {
            return constants.linkingUri;
        }
    } catch {
        // Fall through when expo-constants is unavailable.
    }
    return undefined;
}

export interface ResolveApiUrlOptions {
    envUrl?: string;
    prodUrl: string;
    devPort: number;
    devPath: string;
    expoGoLinkingUri?: string;
}

export function resolveApiUrl({
    envUrl,
    prodUrl,
    devPort,
    devPath,
    expoGoLinkingUri,
}: ResolveApiUrlOptions): string {
    if (envUrl) return envUrl;
    if (!development) return prodUrl;

    const linkingUri = getExpoGoLinkingUri(expoGoLinkingUri);
    if (linkingUri) {
        try {
            const host = new URL(linkingUri).hostname;
            if (host) return `http://${host}:${devPort}${devPath}`;
        } catch {
            // Fall through to localhost when Expo did not provide a valid linking URI.
        }
    }

    return `http://localhost:${devPort}${devPath}`;
}

export function resolveAuthApiUrl(expoGoLinkingUri?: string): string {
    return resolveApiUrl({
        envUrl: process.env.EXPO_PUBLIC_AUTH_API_URL,
        prodUrl: productionApiUrls.auth,
        devPort: 3504,
        devPath: '/api/v1',
        expoGoLinkingUri,
    });
}

export function resolvePosApiUrl(expoGoLinkingUri?: string): string {
    return resolveApiUrl({
        envUrl: process.env.EXPO_PUBLIC_POS_API_URL,
        prodUrl: productionApiUrls.pos,
        devPort: 3501,
        devPath: '/api/graphql',
        expoGoLinkingUri,
    });
}

export function resolvePosBaseUrl(expoGoLinkingUri?: string): string {
    return resolveApiUrl({
        envUrl: process.env.EXPO_PUBLIC_POS_BASE_URL,
        prodUrl: productionApiUrls.posBase,
        devPort: 3501,
        devPath: '/api',
        expoGoLinkingUri,
    });
}

export const env = {
    posApiUrl: resolvePosApiUrl(),
    posBaseUrl: resolvePosBaseUrl(),
    authApiUrl: resolveAuthApiUrl(),
    authAppId: process.env.EXPO_PUBLIC_AUTH_APP_ID,
} as const;
