import { requestGraphQL } from './baseApi';
import { env } from '../../config/env';

export function requestPos<T>(
  token: string,
  tenantId: string,
  query: string,
  variables: Record<string, unknown> = {},
) {
  return requestGraphQL<T>(env.posApiUrl, query, variables, { token, tenantId });
}
