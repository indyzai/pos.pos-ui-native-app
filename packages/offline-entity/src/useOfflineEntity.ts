import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSyncCoordinator, type SyncCoordinator } from "./coordinator";
import type {
    EntityContext,
    LocalMutation,
    LocalRecord,
    MutationOptions,
    OfflineRepository,
    OfflineSyncAdapter,
    SortInput,
} from "./types";

const makeId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
type PageState<T> = {
    rows: LocalRecord<T>[];
    localCursor: string | null;
    localHasMore: boolean;
    serverCursor: string | null;
    serverHasMore: boolean;
    serverLoaded: boolean;
};
const emptyPage = <T>(): PageState<T> => ({
    rows: [],
    localCursor: null,
    localHasMore: true,
    serverCursor: null,
    serverHasMore: true,
    serverLoaded: false,
});

export interface UseOfflineEntityOptions<T, TList, TCreate, TUpdate, TFilter>
    extends EntityContext {
    tableName: string;
    listSelector: (record: LocalRecord<T>) => TList;
    createPayload?: (input: TCreate) => T;
    updatePayload?: (current: T, input: TUpdate) => T;
    repository: OfflineRepository<T, TFilter>;
    syncAdapter?: OfflineSyncAdapter<T, TCreate, TUpdate, TFilter>;
    coordinator?: SyncCoordinator;
    pageSize?: number;
    autoSync?: boolean;
    syncIntervalMs?: number;
    includeDeleted?: boolean;
    serverPagination?: boolean;
    remoteSearch?: boolean;
    minimumRemoteSearchLength?: number;
    searchDebounceMs?: number;
    filter?: TFilter;
    sort?: SortInput;
    mutationMode?: "STATE" | "EVENT";
    trackIdempotencyKey?: string;
    online?: () => boolean;
}

export function useOfflineEntity<
    TPayload,
    TListItem = TPayload,
    TCreateInput = Partial<TPayload>,
    TUpdateInput = Partial<TPayload>,
    TFilter = Record<string, unknown>,
>(
    options: UseOfflineEntityOptions<
        TPayload,
        TListItem,
        TCreateInput,
        TUpdateInput,
        TFilter
    >,
) {
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState<PageState<TPayload>>(emptyPage);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [mutationPending, setMutationPending] = useState(false);
    const [mutationStatus, setMutationStatus] = useState<
        LocalMutation["status"] | null
    >(null);
    const [trackedKey, setTrackedKey] = useState<string | undefined>(
        options.trackIdempotencyKey,
    );
    const [revision, setRevision] = useState(0);
    const sequence = useRef(0);
    const loadLock = useRef(false);
    const remoteInFlight = useRef(new Map<string, number>());
    const cache = useRef(new Map<string, PageState<TPayload>>());
    const latest = useRef(options);
    latest.current = options;
    const size = Math.max(1, Math.min(options.pageSize ?? 25, 100));
    const contextKey = JSON.stringify([
        options.tableName,
        options.scope,
        options.tenantId,
        options.storeId ?? null,
        searchQuery,
        options.filter ?? null,
        options.sort ?? null,
        options.includeDeleted ?? false,
        options.pageSize ?? 25,
    ]);
    const context = useMemo<EntityContext>(
        () => ({
            scope: options.scope,
            tenantId: options.tenantId,
            storeId: options.storeId,
        }),
        [options.scope, options.tenantId, options.storeId],
    );
    const coordinator = useMemo(
        () =>
            options.coordinator ??
            createSyncCoordinator({
                repository: options.repository,
                adapter: {
                    get create() {
                        return latest.current.syncAdapter?.create;
                    },
                    get update() {
                        return latest.current.syncAdapter?.update;
                    },
                    get delete() {
                        return latest.current.syncAdapter?.delete;
                    },
                },
                context,
                tableName: options.tableName,
                online: () => latest.current.online?.() !== false,
            }),
        [options.coordinator, options.repository, options.tableName, context],
    );

    const active = () => latest.current.online?.() !== false;
    const queryArgs = (cursor: string | null, limit = size) => ({
        ...context,
        tableName: latest.current.tableName,
        limit,
        cursor,
        search: searchQuery || undefined,
        filter: latest.current.filter,
        sort: latest.current.sort,
        includeDeleted: latest.current.includeDeleted,
    });
    const publish = (next: PageState<TPayload>) => {
        cache.current.set(contextKey, next);
        setPage(next);
    };
    const readLocal = async (
        cursor: string | null,
        append: boolean,
        guard: number,
        limit = size,
    ) => {
        const result = await latest.current.repository.list(
            queryArgs(cursor, limit),
        );
        if (guard !== sequence.current) return;
        const previous = cache.current.get(contextKey) ?? emptyPage<TPayload>();
        const rows = append
            ? [
                  ...previous.rows,
                  ...result.items.filter(
                      (row) => !previous.rows.some((old) => old.id === row.id),
                  ),
              ]
            : result.items;
        publish({
            ...previous,
            rows,
            localCursor: result.nextCursor ?? null,
            localHasMore: result.hasMore,
        });
    };
    const fetchRemote = async (after: string | null, guard: number) => {
        const current = latest.current;
        const list = current.syncAdapter?.list;
        const allowed = searchQuery
            ? current.remoteSearch &&
              searchQuery.length >= (current.minimumRemoteSearchLength ?? 2)
            : current.serverPagination;
        if (!list || !allowed || !active()) return;
        if (remoteInFlight.current.get(contextKey) === guard) return;
        remoteInFlight.current.set(contextKey, guard);
        if (searchQuery) setSearching(true);
        try {
            const result = await list({
                ...context,
                first: size,
                after,
                search: searchQuery || undefined,
                filter: current.filter,
                sort: current.sort,
            });
            if (guard !== sequence.current) return;
            if (
                result.hasNextPage &&
                (!result.endCursor || result.endCursor === after)
            )
                throw new Error("Remote pagination did not advance.");
            for (const row of result.items) {
                if (guard !== sequence.current) return;
                await current.repository.upsertRemote(
                    current.tableName,
                    row,
                    context,
                );
            }
            if (guard !== sequence.current) return;
            const previous =
                cache.current.get(contextKey) ?? emptyPage<TPayload>();
            publish({
                ...previous,
                serverCursor: result.endCursor ?? null,
                serverHasMore: result.hasNextPage,
                serverLoaded: true,
            });
            // Re-read from the repository so remote data is never UI-only state.
            await readLocal(
                null,
                false,
                guard,
                Math.max(size, previous.rows.length + result.items.length),
            );
            setRevision((value) => value + 1);
        } finally {
            if (remoteInFlight.current.get(contextKey) === guard)
                remoteInFlight.current.delete(contextKey);
            if (guard === sequence.current) setSearching(false);
        }
    };

    const refresh = useCallback(async () => {
        const guard = ++sequence.current;
        setRefreshing(true);
        setError(null);
        try {
            const previous =
                cache.current.get(contextKey) ?? emptyPage<TPayload>();
            publish({
                ...previous,
                localCursor: null,
                serverCursor: null,
                serverHasMore: true,
                serverLoaded: false,
            });
            await readLocal(
                null,
                false,
                guard,
                Math.max(size, previous.rows.length),
            );
            await fetchRemote(null, guard);
        } catch (reason) {
            if (guard === sequence.current)
                setError(
                    reason instanceof Error
                        ? reason
                        : new Error(String(reason)),
                );
        } finally {
            if (guard === sequence.current) {
                setRefreshing(false);
                setLoading(false);
            }
        }
    }, [contextKey, size, searchQuery, context]);

    useEffect(() => {
        const cached = cache.current.get(contextKey);
        if (cached) {
            setPage(cached);
            setLoading(false);
        } else {
            setPage(emptyPage());
            setLoading(true);
        }
        const guard = ++sequence.current;
        let stopped = false;
        const start = async () => {
            try {
                await readLocal(
                    null,
                    false,
                    guard,
                    Math.max(size, cached?.rows.length ?? 0),
                );
                if (!stopped) setLoading(false);
                if (cached?.serverLoaded) return;
                const wait = searchQuery
                    ? (latest.current.searchDebounceMs ?? 300)
                    : 0;
                if (wait)
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, wait),
                    );
                if (!stopped) await fetchRemote(null, guard);
            } catch (reason) {
                if (!stopped && guard === sequence.current)
                    setError(
                        reason instanceof Error
                            ? reason
                            : new Error(String(reason)),
                    );
            } finally {
                if (!stopped) setLoading(false);
            }
        };
        void start();
        const unsubscribe = latest.current.repository.subscribe?.(
            latest.current.tableName,
            () => {
                if (!stopped)
                    void readLocal(
                        null,
                        false,
                        guard,
                        Math.max(
                            size,
                            cache.current.get(contextKey)?.rows.length ?? 0,
                        ),
                    );
            },
        );
        return () => {
            stopped = true;
            ++sequence.current;
            unsubscribe?.();
        };
    }, [contextKey, options.repository, size]);

    useEffect(() => {
        if (!options.autoSync) return;
        const run = () => {
            if (active())
                void coordinator
                    .syncPending({ ...context, tableName: options.tableName })
                    .catch((reason) =>
                        setError(
                            reason instanceof Error
                                ? reason
                                : new Error(String(reason)),
                        ),
                    );
        };
        run();
        const timer = setInterval(
            run,
            Math.max(5_000, options.syncIntervalMs ?? 30_000),
        );
        return () => clearInterval(timer);
    }, [
        options.autoSync,
        options.syncIntervalMs,
        options.tableName,
        coordinator,
        context,
    ]);

    const loadMore = useCallback(async () => {
        if (loadLock.current) return;
        const current = cache.current.get(contextKey) ?? page;
        const remoteAllowed = searchQuery
            ? !!latest.current.remoteSearch &&
              searchQuery.length >=
                  (latest.current.minimumRemoteSearchLength ?? 2)
            : !!latest.current.serverPagination;
        if (
            !current.localHasMore &&
            (!remoteAllowed ||
                !current.serverHasMore ||
                !latest.current.syncAdapter?.list)
        )
            return;
        loadLock.current = true;
        setLoadingMore(true);
        const guard = sequence.current;
        try {
            if (current.localHasMore)
                await readLocal(current.localCursor, true, guard);
            else if (current.serverHasMore)
                await fetchRemote(current.serverCursor, guard);
        } catch (reason) {
            if (guard === sequence.current)
                setError(
                    reason instanceof Error
                        ? reason
                        : new Error(String(reason)),
                );
        } finally {
            loadLock.current = false;
            if (guard === sequence.current) setLoadingMore(false);
        }
    }, [contextKey, page]);

    const getById = useCallback(
        async (id: string, opts?: { refreshFromServer?: boolean }) => {
            const current = latest.current;
            const local =
                (await current.repository.getById({
                    ...context,
                    tableName: current.tableName,
                    id,
                })) ??
                (await current.repository.getByRemoteId({
                    ...context,
                    tableName: current.tableName,
                    remoteId: id,
                }));
            if (
                !opts?.refreshFromServer ||
                !current.syncAdapter?.getById ||
                !active()
            )
                return local;
            const remoteId = local?.remoteId ?? id;
            const remote = await current.syncAdapter.getById({
                ...context,
                remoteId,
            });
            if (!remote) return local;
            const merged = await current.repository.upsertRemote(
                current.tableName,
                { ...remote, payloadCompleteness: "FULL" },
                context,
            );
            setRevision((value) => value + 1);
            return merged;
        },
        [context],
    );

    const mutate = useCallback(
        async (
            type: LocalMutation["type"],
            id: string | null,
            input: TCreateInput | TUpdateInput | null,
            opts?: MutationOptions,
        ) => {
            const current = latest.current;
            if (opts?.idempotencyKey) {
                const jobs = await current.repository.listMutations({
                    ...context,
                    tableName: current.tableName,
                });
                const prior = jobs.find(
                    (job) => job.idempotencyKey === opts.idempotencyKey,
                );
                if (prior) {
                    if (
                        prior.type !== type ||
                        (id && prior.recordId !== id) ||
                        JSON.stringify(prior.input) !== JSON.stringify(input)
                    )
                        throw new Error(
                            "An idempotency key was reused with different arguments.",
                        );
                    const replayed = await current.repository.getById({
                        ...context,
                        tableName: current.tableName,
                        id: prior.recordId,
                    });
                    if (!replayed)
                        throw new Error(
                            "The original local record is missing.",
                        );
                    setTrackedKey(opts.idempotencyKey);
                    setMutationStatus(prior.status);
                    setMutationPending(
                        prior.status === "PENDING" ||
                            prior.status === "SYNCING",
                    );
                    return replayed;
                }
            }
            const existing = id
                ? await current.repository.getById({
                      ...context,
                      tableName: current.tableName,
                      id,
                  })
                : null;
            if (id && !existing) throw new Error("Local record was not found.");
            const now = Date.now();
            const recordId = existing?.id ?? makeId();
            const key = opts?.idempotencyKey ?? makeId();
            const record: LocalRecord<TPayload> = {
                id: recordId,
                scope: context.scope,
                tenantId: context.tenantId,
                storeId: context.storeId,
                remoteId: existing?.remoteId ?? null,
                payload:
                    type === "DELETE"
                        ? existing!.payload
                        : type === "CREATE"
                          ? (current.createPayload?.(input as TCreateInput) ??
                            (input as TPayload))
                          : (current.updatePayload?.(
                                existing!.payload,
                                input as TUpdateInput,
                            ) ??
                            ({
                                ...(existing!.payload as object),
                                ...(input as object),
                            } as TPayload)),
                serverVersion: existing?.serverVersion ?? 0,
                syncStatus: "PENDING",
                updatedAt: now,
                deletedAt:
                    type === "DELETE" ? now : (existing?.deletedAt ?? null),
                payloadCompleteness: existing?.payloadCompleteness ?? "FULL",
            };
            const mutation: LocalMutation = {
                id: makeId(),
                tableName: current.tableName,
                recordId,
                type,
                idempotencyKey: key,
                explicitKey: !!opts?.idempotencyKey,
                status: "PENDING",
                createdAt: now,
                updatedAt: now,
                retryCount: 0,
                input,
                ...context,
            };
            await current.repository.commitMutation(
                record,
                mutation,
                current.mutationMode ?? "STATE",
            );
            if (opts?.idempotencyKey) setTrackedKey(key);
            if (opts?.idempotencyKey || current.trackIdempotencyKey === key) {
                setMutationPending(true);
                setMutationStatus("PENDING");
            }
            setRevision((value) => value + 1);
            if (opts?.syncImmediately ?? current.autoSync)
                void coordinator
                    .syncRecord({ tableName: current.tableName, id: recordId })
                    .catch(setError);
            return record;
        },
        [context, coordinator],
    );

    useEffect(() => {
        const key = options.trackIdempotencyKey ?? trackedKey;
        if (!key) return;
        let live = true;
        const inspect = async () => {
            const jobs = await options.repository.listMutations({
                ...context,
                tableName: options.tableName,
            });
            const match = jobs.find((job) => job.idempotencyKey === key);
            if (live) {
                setMutationStatus(match?.status ?? null);
                setMutationPending(
                    match?.status === "PENDING" || match?.status === "SYNCING",
                );
            }
        };
        void inspect();
        const unsubscribe = options.repository.subscribe?.(
            options.tableName,
            () => void inspect(),
        );
        return () => {
            live = false;
            unsubscribe?.();
        };
    }, [
        options.trackIdempotencyKey,
        trackedKey,
        options.repository,
        options.tableName,
        context,
        revision,
    ]);

    return {
        items: page.rows.map(options.listSelector),
        loading,
        refreshing,
        loadingMore,
        searching,
        error,
        hasMore:
            page.localHasMore ||
            (!!options.syncAdapter?.list &&
                page.serverHasMore &&
                (searchQuery
                    ? !!options.remoteSearch &&
                      searchQuery.length >=
                          (options.minimumRemoteSearchLength ?? 2)
                    : !!options.serverPagination)),
        localHasMore: page.localHasMore,
        serverHasMore: page.serverHasMore,
        searchQuery,
        setSearch: setSearchQuery,
        clearSearch: () => setSearchQuery(""),
        mutationPending,
        mutationStatus,
        refresh,
        loadMore,
        getById,
        insert: (input: TCreateInput, opts?: MutationOptions) =>
            mutate("CREATE", null, input, opts),
        update: (id: string, input: TUpdateInput, opts?: MutationOptions) =>
            mutate("UPDATE", id, input, opts),
        remove: async (id: string, opts?: MutationOptions) => {
            await mutate("DELETE", id, null, opts);
        },
        syncRecord: (id: string) =>
            coordinator.syncRecord({ tableName: options.tableName, id }),
        syncPending: () =>
            coordinator.syncPending({
                ...context,
                tableName: options.tableName,
            }),
    };
}
