import { afterEach, expect, test } from 'bun:test';
import { requestJson, requestGraphQL, setUnauthorizedHandler } from '../src/core/api/baseApi';
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
