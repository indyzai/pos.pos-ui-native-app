import { afterEach, expect, test } from 'bun:test';
import { requestJson, requestGraphQL, setUnauthorizedHandler } from '@indyzai/pos-api';
const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
});
test('authenticated 401 expires session but network, 403, and public login failures do not', async () => {
    const tokens = [];
    const dispose = setUnauthorizedHandler(async (token) => {
        tokens.push(token);
    });
    try {
        for (const status of [401, 403, 500]) {
            globalThis.fetch = async () => new Response('{}', { status });
            await expect(requestJson('https://example.test', { token: 'expired' })).rejects.toThrow();
        }
        await expect(requestJson('https://example.test')).rejects.toThrow();
        globalThis.fetch = async () => {
            throw new Error('Offline');
        };
        await expect(requestJson('https://example.test', { token: 'expired' })).rejects.toThrow();
        expect(tokens).toEqual(['expired']);
    } finally {
        dispose();
    }
});
test('GraphQL authentication failure expires session even with HTTP 200', async () => {
    const tokens = [];
    const dispose = setUnauthorizedHandler(async (token) => {
        tokens.push(token);
    });
    try {
        globalThis.fetch = async () =>
            Response.json({ errors: [{ message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } }] });
        await expect(
            requestGraphQL('https://example.test', '{ me { id } }', {}, { token: 'expired' }),
        ).rejects.toThrow('Unauthorized');
        expect(tokens).toEqual(['expired']);
    } finally {
        dispose();
    }
});
test('authenticated 401 with Authorization header expires session', async () => {
    const tokens = [];
    const dispose = setUnauthorizedHandler(async (token) => {
        tokens.push(token);
    });
    try {
        globalThis.fetch = async () => new Response('{}', { status: 401 });
        await expect(
            requestJson('https://example.test', { headers: { Authorization: 'Bearer header-expired' } }),
        ).rejects.toThrow();
        expect(tokens).toEqual(['header-expired']);
    } finally {
        dispose();
    }
});
test('GraphQL error variations (UNAUTHORIZED, statusCode, response.statusCode, message) expire session', async () => {
    const errorVariations = [
        { message: 'Unauthorized', extensions: { code: 'UNAUTHORIZED' } },
        { message: 'Session invalid', extensions: { statusCode: 401 } },
        { message: 'Not allowed', extensions: { response: { statusCode: 401 } } },
        { message: 'jwt expired', extensions: {} },
    ];
    for (const error of errorVariations) {
        const tokens = [];
        const dispose = setUnauthorizedHandler(async (token) => {
            tokens.push(token);
        });
        try {
            globalThis.fetch = async () => Response.json({ errors: [error] });
            await expect(
                requestGraphQL('https://example.test', '{ me { id } }', {}, { token: 'expired-gql' }),
            ).rejects.toThrow();
            expect(tokens).toEqual(['expired-gql']);
        } finally {
            dispose();
        }
    }
});
