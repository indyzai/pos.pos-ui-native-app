export {
    ApiError,
    requestGraphQL,
    requestJson,
    setUnauthorizedHandler,
} from "./http";
export type { RequestOptions } from "./http";

export function createGraphQLClient(
    resolveUrl: () => string | Promise<string>,
) {
    return async function request<T>(
        query: string,
        variables: Record<string, unknown> = {},
        options: import("./http").RequestOptions = {},
    ): Promise<T> {
        const { requestGraphQL } = await import("./http");
        return requestGraphQL<T>(await resolveUrl(), query, variables, options);
    };
}
