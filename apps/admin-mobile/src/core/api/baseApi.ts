let onUnauthorized: ((token: string) => Promise<void>) | undefined;
export function setUnauthorizedHandler(handler: (token: string) => Promise<void>) {
    onUnauthorized = handler;
    return () => {
        if (onUnauthorized === handler) onUnauthorized = undefined;
    };
}
async function invalidateSession(token?: string) {
    if (token) await onUnauthorized?.(token);
}

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string;
    tenantId?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    signal?: AbortSignal;
};

function errorMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object' || !('message' in body)) return;
    const message = body.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join(', ');
}

/** Shared JSON transport. No automatic retries, especially for writes. */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
        const response = await fetch(url, {
            method: options.method ?? 'GET',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
                ...(options.tenantId ? { 'x-tenant-id': options.tenantId } : {}),
                ...options.headers,
            },
            ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        });
        if (response.status === 204) return undefined as T;
        let body: unknown;
        try {
            body = await response.json();
        } catch {
            if (response.ok) throw new ApiError('API returned invalid JSON.', response.status);
        }
        if (!response.ok) {
            if (response.status === 401) await invalidateSession(options.token);
            throw new ApiError(
                errorMessage(body) ||
                    (response.status === 401
                        ? 'Session expired. Sign in again.'
                        : 'API request failed (' + response.status + ').'),
                response.status,
            );
        }
        return body as T;
    } catch (error) {
        if (options.signal?.aborted) throw new ApiError('Refresh cancelled.');
        if (controller.signal.aborted) throw new ApiError('Request timed out. Please try again.');
        throw error;
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancel);
    }
}

export async function requestGraphQL<T>(
    url: string,
    query: string,
    variables: Record<string, unknown> = {},
    options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<T> {
    const result = await requestJson<{
        data?: T;
        errors?: {
            message: string;
            extensions?: { code?: string; status?: number; originalError?: { statusCode?: number } };
        }[];
    }>(url, {
        ...options,
        method: 'POST',
        body: { query, variables },
    });
    if (result?.errors?.length) {
        const unauthorized = result.errors.some(
            (error) =>
                error.extensions?.code === 'UNAUTHENTICATED' ||
                error.extensions?.status === 401 ||
                error.extensions?.originalError?.statusCode === 401,
        );
        if (unauthorized) await invalidateSession(options.token);
        throw new ApiError(
            result.errors.map((error) => error.message).join('; '),
            unauthorized ? 401 : undefined,
        );
    }
    if (result?.data == null) throw new ApiError('API returned no data.');
    return result.data;
}
