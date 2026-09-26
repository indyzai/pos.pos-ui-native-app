export type SyncStatus =
    | "LOCAL"
    | "PENDING"
    | "SYNCING"
    | "SYNCED"
    | "FAILED"
    | "CONFLICT";
export type MutationStatus = Extract<
    SyncStatus,
    "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT"
>;
export type MutationMode = "STATE" | "EVENT";
export type PayloadCompleteness = "LIST" | "FULL";
export type SortInput = { field: string; direction: "asc" | "desc" };
export type LocalRecord<T> = {
    id: string;
    scope: string;
    tenantId: string;
    storeId?: string | null;
    remoteId?: string | null;
    payload: T;
    serverVersion: number;
    syncStatus: SyncStatus;
    updatedAt: number;
    deletedAt?: number | null;
    payloadCompleteness?: PayloadCompleteness;
};
export type LocalMutation = {
    id: string;
    tableName: string;
    recordId: string;
    type: "CREATE" | "UPDATE" | "DELETE";
    idempotencyKey: string;
    explicitKey?: boolean;
    status: MutationStatus;
    createdAt: number;
    updatedAt: number;
    retryCount: number;
    error?: string | null;
    input: unknown;
    scope: string;
    tenantId: string;
    storeId?: string | null;
};
export type EntityContext = {
    scope: string;
    tenantId: string;
    storeId?: string | null;
};
export type ListOptions<TFilter> = EntityContext & {
    tableName: string;
    limit: number;
    cursor?: string | null;
    search?: string;
    filter?: TFilter;
    sort?: SortInput;
    includeDeleted?: boolean;
};
export type LocalPage<T> = {
    items: LocalRecord<T>[];
    nextCursor?: string | null;
    hasMore: boolean;
};
export type RemoteRecord<T> = {
    remoteId: string;
    payload: T;
    serverVersion: number;
    updatedAt: number;
    deletedAt?: number | null;
    payloadCompleteness?: PayloadCompleteness;
};
export type RemotePageResult<T> = {
    items: RemoteRecord<T>[];
    endCursor?: string | null;
    hasNextPage: boolean;
};
export type RemoteMutationResult<T> = RemoteRecord<T>;
export interface OfflineRepository<T, TFilter = Record<string, unknown>> {
    list(options: ListOptions<TFilter>): Promise<LocalPage<T>>;
    getById(
        options: EntityContext & { tableName: string; id: string },
    ): Promise<LocalRecord<T> | null>;
    getByRemoteId(
        options: EntityContext & { tableName: string; remoteId: string },
    ): Promise<LocalRecord<T> | null>;
    /** Persist record and replay metadata in one transaction. */
    commitMutation(
        record: LocalRecord<T>,
        mutation: LocalMutation,
        mode?: MutationMode,
    ): Promise<void>;
    upsertRemote(
        tableName: string,
        remote: RemoteRecord<T>,
        context: EntityContext,
    ): Promise<LocalRecord<T>>;
    acknowledgeMutation(
        mutation: LocalMutation,
        remote: RemoteRecord<T>,
    ): Promise<void>;
    listMutations(
        context: EntityContext & { tableName: string; recordId?: string },
    ): Promise<LocalMutation[]>;
    updateMutation(id: string, changes: Partial<LocalMutation>): Promise<void>;
    updateRecord(
        tableName: string,
        id: string,
        changes: Partial<LocalRecord<T>>,
    ): Promise<void>;
    subscribe?(tableName: string, listener: () => void): () => void;
}
export interface OfflineSyncAdapter<
    T,
    TCreate,
    TUpdate,
    TFilter = Record<string, unknown>,
> {
    list?: (
        args: EntityContext & {
            first: number;
            after?: string | null;
            search?: string;
            filter?: TFilter;
            sort?: SortInput;
            signal?: AbortSignal;
        },
    ) => Promise<RemotePageResult<T>>;
    getById?: (
        args: EntityContext & { remoteId: string; signal?: AbortSignal },
    ) => Promise<RemoteMutationResult<T> | null>;
    create?: (args: {
        record: LocalRecord<T>;
        input: TCreate;
        idempotencyKey: string;
    }) => Promise<RemoteMutationResult<T>>;
    update?: (args: {
        record: LocalRecord<T>;
        input: TUpdate;
        idempotencyKey: string;
        expectedVersion: number;
    }) => Promise<RemoteMutationResult<T>>;
    delete?: (args: {
        record: LocalRecord<T>;
        idempotencyKey: string;
        expectedVersion: number;
    }) => Promise<RemoteMutationResult<T>>;
}
export type MutationOptions = {
    idempotencyKey?: string;
    syncImmediately?: boolean;
};
