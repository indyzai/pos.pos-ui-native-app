import { createGraphQLClient, requestJson } from '@indyzai/pos-backend';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';
import { createLogger } from '@indyzai/pos-core';

const graphql = createGraphQLClient(async () => (await getRuntimeApiUrls()).posApiUrl);
const logger = createLogger('POS API');

export function requestPos<T>(
  token: string,
  tenantId: string,
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  return graphql<T>(query, variables, { token, tenantId, signal });
}

export async function requestPosBootstrap<T>(
  token: string,
  tenantId: string,
  options: {
    role?: string;
    route?: string;
    collections?: string[];
    limit?: number;
    signal?: AbortSignal;
  } = {},
) {
  const { posBaseUrl } = await getRuntimeApiUrls();
  const url = new URL(`${posBaseUrl.replace(/\/$/, '')}/sync/bootstrap`);
  url.search = new URLSearchParams({
    route: options.route ?? '/',
    limit: String(options.limit ?? 1000),
    ...(options.role ? { role: options.role } : {}),
    ...(options.collections?.length ? { collections: options.collections.join(',') } : {}),
  }).toString();
  logger.info('Loading bootstrap data', {
    route: options.route ?? '/',
    collections: options.collections,
    url: url.origin + url.pathname,
  });
  try {
    const result = await requestJson<T>(url.toString(), {
      token,
      tenantId,
      signal: options.signal,
      timeoutMs: 30_000,
    });
    logger.info('Bootstrap data loaded', { route: options.route ?? '/' });
    return result;
  } catch (error) {
    logger.error('Bootstrap request failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function requestPosHasUpdates<T>(
  token: string,
  tenantId: string,
  options: { since?: string; route?: string; collections?: string[]; signal?: AbortSignal } = {},
) {
  const { posBaseUrl } = await getRuntimeApiUrls();
  const url = new URL(`${posBaseUrl.replace(/\/$/, '')}/sync/has-updates`);
  url.search = new URLSearchParams({
    route: options.route ?? '/',
    ...(options.since ? { since: options.since } : {}),
    ...(options.collections?.length ? { collections: options.collections.join(',') } : {}),
  }).toString();
  return requestJson<T>(url.toString(), { token, tenantId, signal: options.signal, timeoutMs: 15_000 });
}
