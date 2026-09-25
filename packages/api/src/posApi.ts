import { createGraphQLClient } from './graphql';
import { requestJson } from './http';
import { createLogger } from '@indyzai/pos-utils';

export interface PosApiClientOptions {
  getRuntimeApiUrls: () => Promise<{ posApiUrl: string; posBaseUrl: string; authApiUrl: string }>;
  loggerScope?: string;
}

export function createPosApiClient(options: PosApiClientOptions) {
  const graphql = createGraphQLClient(async () => (await options.getRuntimeApiUrls()).posApiUrl);
  const logger = createLogger(options.loggerScope ?? 'POS API');

  function requestPos<T>(
    token: string,
    tenantId: string,
    query: string,
    variables: Record<string, unknown> = {},
    signal?: AbortSignal,
  ) {
    return graphql<T>(query, variables, { token, tenantId, signal });
  }

  async function requestPosBootstrap<T>(
    token: string,
    tenantId: string,
    reqOptions: {
      role?: string;
      route?: string;
      collections?: string[];
      limit?: number;
      signal?: AbortSignal;
    } = {},
  ) {
    const { posBaseUrl } = await options.getRuntimeApiUrls();
    const url = new URL(`${posBaseUrl.replace(/\/$/, '')}/sync/bootstrap`);
    url.search = new URLSearchParams({
      route: reqOptions.route ?? '/',
      limit: String(reqOptions.limit ?? 1000),
      ...(reqOptions.role ? { role: reqOptions.role } : {}),
      ...(reqOptions.collections?.length ? { collections: reqOptions.collections.join(',') } : {}),
    }).toString();
    logger.info('Loading bootstrap data', {
      route: reqOptions.route ?? '/',
      collections: reqOptions.collections,
      url: url.origin + url.pathname,
    });
    try {
      const result = await requestJson<T>(url.toString(), {
        token,
        tenantId,
        signal: reqOptions.signal,
        timeoutMs: 30_000,
      });
      logger.info('Bootstrap data loaded', { route: reqOptions.route ?? '/' });
      return result;
    } catch (error) {
      logger.error('Bootstrap request failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function requestPosHasUpdates<T>(
    token: string,
    tenantId: string,
    reqOptions: { since?: string; route?: string; collections?: string[]; signal?: AbortSignal } = {},
  ) {
    const { posBaseUrl } = await options.getRuntimeApiUrls();
    const url = new URL(`${posBaseUrl.replace(/\/$/, '')}/sync/has-updates`);
    url.search = new URLSearchParams({
      route: reqOptions.route ?? '/',
      ...(reqOptions.since ? { since: reqOptions.since } : {}),
      ...(reqOptions.collections?.length ? { collections: reqOptions.collections.join(',') } : {}),
    }).toString();
    return requestJson<T>(url.toString(), { token, tenantId, signal: reqOptions.signal, timeoutMs: 15_000 });
  }

  return {
    graphql,
    requestPos,
    requestPosBootstrap,
    requestPosHasUpdates,
  };
}
