import { requestGraphQL, type RequestOptions } from "./http";

export function createGraphQLClient(
    resolveUrl: () => string | Promise<string>,
) {
    return async function request<T>(
        query: string,
        variables: Record<string, unknown> = {},
        options: RequestOptions = {},
    ): Promise<T> {
        return requestGraphQL<T>(await resolveUrl(), query, variables, options);
    };
}
