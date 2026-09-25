export interface FeatureContext {
    scope: string;
    tenant: string;
    token: string;
}

export type FeatureRequest = <T>(
    token: string,
    tenant: string,
    query: string,
    variables?: Record<string, unknown>,
    signal?: AbortSignal,
) => Promise<T>;

/** A response from an old session must never be committed after a workspace switch. */
export function assertFeatureContext(
    expected: FeatureContext,
    current: FeatureContext,
): void {
    if (
        expected.scope !== current.scope ||
        expected.tenant !== current.tenant ||
        expected.token !== current.token
    ) {
        throw new Error("Your workspace changed. Please retry.");
    }
}
