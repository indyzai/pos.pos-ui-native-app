import { createGraphQLClient } from '@indyzai/pos-backend';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';

const graphql = createGraphQLClient(async () => (await getRuntimeApiUrls()).posApiUrl);

export function requestPos<T>(
  token: string,
  tenantId: string,
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  return graphql<T>(query, variables, { token, tenantId, signal });
}
