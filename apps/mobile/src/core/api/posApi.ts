import { requestGraphQL } from './baseApi';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';

export function requestPos<T>(
  token: string,
  tenantId: string,
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  return getRuntimeApiUrls().then(({ posApiUrl }) =>
    requestGraphQL<T>(posApiUrl, query, variables, { token, tenantId, signal }),
  );
}
