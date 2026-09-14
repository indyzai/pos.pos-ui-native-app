import { useCallback, useMemo } from "react";
import { useLocalCollection } from "./hooks";
import { useLocalDatabase } from "./react";
import {
    createScopeKey,
    type CollectionName,
    type LocalQuery,
    type LocalRecord,
} from "./types";

export type MutationDependency = {
    /** Outbox job which must receive a server ID before this mutation can be sent. */
    jobId: string;
};

export type CreateTableMutation<TPayload extends Record<string, unknown>> = {
    payload: TPayload;
    operation: "CREATE" | "UPDATE" | "DELETE" | string;
    localId?: string;
    idempotencyKey?: string;
    dependencies?: readonly MutationDependency[];
    storeId?: string | null;
    baseServerVersion?: number;
};

export type ResolveTableMutation<TPayload extends Record<string, unknown>> = {
    jobId: string;
    serverId: string;
    serverVersion?: number;
    payload?: TPayload;
};

export type TableOutboxPayload<
    TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
    entityType: string;
    table: CollectionName;
    localId: string;
    offlineId: string;
    idempotencyKey: string;
    operation: string;
    data: TPayload;
    dependencyJobIds: string[];
    serverId?: string;
};

type DependencyPayload = { jobId: string; dependsOnJobId: string };

export type LocalFirstTableHookConfig<
    TPayload extends Record<string, unknown>,
> = {
    table: CollectionName;
    entityType?: string;
    query?: LocalQuery;
    /** Adds feature-defined dependencies in addition to dependencies passed per mutation. */
    dependencies?: (payload: TPayload) => readonly MutationDependency[];
};

const identifier = () => {
    if (typeof globalThis.crypto?.randomUUID === "function")
        return globalThis.crypto.randomUUID();
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function replaceId(value: unknown, oldId: string, serverId: string): unknown {
    if (value === oldId) return serverId;
    if (Array.isArray(value))
        return value.map((item) => replaceId(item, oldId, serverId));
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(
                ([key, item]) => [key, replaceId(item, oldId, serverId)],
            ),
        );
    }
    return value;
}

/**
 * Creates a feature hook backed only by a local table and the shared sync outbox.
 * API workers resolve mutations with `resolveMutation`; UI code never waits on the API directly.
 */
export function createLocalFirstTableHook<
    TPayload extends Record<string, unknown>,
>(config: LocalFirstTableHookConfig<TPayload>) {
    const entityType = config.entityType ?? config.table.toUpperCase();

    return function useLocalFirstTable() {
        const local = useLocalDatabase();
        const database = local.database;
        const table = useLocalCollection<LocalRecord<TPayload>>(
            config.table,
            config.query,
        );
        const outbox = useLocalCollection<LocalRecord<TableOutboxPayload>>(
            "sync_outbox",
            {
                includeDeleted: true,
            },
        );
        const dependencyRows = useLocalCollection<
            LocalRecord<DependencyPayload>
        >("sync_dependencies", {
            includeDeleted: true,
        });

        const relevantJobs = useMemo(
            () =>
                outbox.records.filter(
                    (record) => record.payload.table === config.table,
                ),
            [outbox.records],
        );
        const jobsByOfflineId = useMemo(
            () =>
                new Map(
                    outbox.records.map((record) => [
                        record.payload.offlineId ||
                            record.remoteId ||
                            record.id,
                        record,
                    ]),
                ),
            [outbox.records],
        );
        const dependencyResolved = useCallback(
            (jobId: string) => {
                const dependency = jobsByOfflineId.get(jobId);
                return (
                    dependency?.syncStatus === "SYNCED" &&
                    Boolean(dependency.payload.serverId)
                );
            },
            [jobsByOfflineId],
        );
        const updatingIds = useMemo(() => {
            const result = new Set<string>();
            for (const job of relevantJobs) {
                const dependencies = dependencyRows.records
                    .filter(
                        (dependency) =>
                            dependency.payload.jobId === job.payload.offlineId,
                    )
                    .map((dependency) => dependency.payload.dependsOnJobId);
                const row = table.records.find(
                    (record) => record.id === job.payload.localId,
                );
                if (
                    job.syncStatus === "PENDING" ||
                    job.syncStatus === "RUNNING" ||
                    !row?.remoteId ||
                    dependencies.some(
                        (dependencyId) => !dependencyResolved(dependencyId),
                    )
                ) {
                    result.add(job.payload.localId);
                }
            }
            return result;
        }, [
            dependencyRows.records,
            dependencyResolved,
            relevantJobs,
            table.records,
        ]);
        const pendingMutations = useMemo(
            () =>
                relevantJobs.filter(
                    (job) =>
                        job.syncStatus === "PENDING" ||
                        job.syncStatus === "RUNNING",
                ),
            [relevantJobs],
        );
        const readyMutations = useMemo(
            () =>
                pendingMutations.filter((job) =>
                    job.payload.dependencyJobIds.every(dependencyResolved),
                ),
            [dependencyResolved, pendingMutations],
        );

        const query = useCallback(
            (details: LocalQuery = config.query ?? {}) => {
                if (!database || local.status !== "ready")
                    throw new Error("The local database is not ready.");
                return database
                    .collection<LocalRecord<TPayload>>(config.table)
                    .list(details);
            },
            [database, local.status],
        );

        const createMutation = useCallback(
            async (input: CreateTableMutation<TPayload>) => {
                if (!database || local.status !== "ready")
                    throw new Error("The local database is not ready.");
                const now = Date.now();
                const scope = createScopeKey(database.scope);
                const localId = input.localId ?? identifier();
                const jobId = identifier();
                const dependencies = [
                    ...(config.dependencies?.(input.payload) ?? []),
                    ...(input.dependencies ?? []),
                ].filter(
                    (dependency, index, all) =>
                        all.findIndex(
                            (candidate) => candidate.jobId === dependency.jobId,
                        ) === index,
                );
                const idempotencyKey =
                    input.idempotencyKey ??
                    `${entityType}:${localId}:${input.operation}`;
                const current = input.localId
                    ? await database
                          .collection<LocalRecord<TPayload>>(config.table)
                          .get(input.localId)
                    : undefined;
                const record: LocalRecord<TPayload> = {
                    id: localId,
                    scope,
                    tenantId: database.scope.tenantId,
                    storeId:
                        input.storeId ?? database.scope.storeIds[0] ?? null,
                    remoteId: current?.remoteId ?? null,
                    payload: {
                        ...current?.payload,
                        ...input.payload,
                        id: current?.remoteId ?? localId,
                    },
                    serverVersion:
                        input.baseServerVersion ?? current?.serverVersion ?? 0,
                    syncStatus: "PENDING",
                    updatedAt: now,
                    deletedAt: input.operation === "DELETE" ? now : null,
                };
                const payload: TableOutboxPayload<TPayload> = {
                    entityType,
                    table: config.table,
                    localId,
                    offlineId: jobId,
                    idempotencyKey,
                    operation: input.operation,
                    data: record.payload,
                    dependencyJobIds: dependencies.map(
                        (dependency) => dependency.jobId,
                    ),
                };
                const job: LocalRecord<TableOutboxPayload<TPayload>> = {
                    id: `${scope}:sync_outbox:${jobId}`,
                    scope,
                    tenantId: database.scope.tenantId,
                    storeId: record.storeId,
                    remoteId: jobId,
                    payload,
                    serverVersion: input.baseServerVersion ?? 0,
                    syncStatus: "PENDING",
                    updatedAt: now,
                    deletedAt: null,
                };
                const dependencyRecords = dependencies.map<
                    LocalRecord<DependencyPayload>
                >((dependency) => ({
                    id: `${scope}:sync_dependencies:${jobId}:${dependency.jobId}`,
                    scope,
                    tenantId: database.scope.tenantId,
                    storeId: record.storeId,
                    remoteId: `${jobId}:${dependency.jobId}`,
                    payload: { jobId, dependsOnJobId: dependency.jobId },
                    serverVersion: 0,
                    syncStatus: "PENDING",
                    updatedAt: now,
                    deletedAt: null,
                }));
                await database.transaction(
                    [config.table, "sync_outbox", "sync_dependencies"],
                    async () => {
                        await database
                            .collection<LocalRecord<TPayload>>(config.table)
                            .put(record);
                        await database
                            .collection<
                                LocalRecord<TableOutboxPayload<TPayload>>
                            >("sync_outbox")
                            .put(job);
                        await database
                            .collection<LocalRecord<DependencyPayload>>(
                                "sync_dependencies",
                            )
                            .putMany(dependencyRecords);
                    },
                );
                return { record, job, dependencies: dependencyRecords };
            },
            [database, local.status],
        );

        const resolveMutation = useCallback(
            async (result: ResolveTableMutation<TPayload>) => {
                if (!database || local.status !== "ready")
                    throw new Error("The local database is not ready.");
                const jobs = await database
                    .collection<LocalRecord<TableOutboxPayload>>("sync_outbox")
                    .list({ includeDeleted: true });
                const job = jobs.find(
                    (candidate) => candidate.payload.offlineId === result.jobId,
                );
                if (!job)
                    throw new Error(
                        `Outbox mutation ${result.jobId} was not found.`,
                    );
                const current = await database
                    .collection<LocalRecord<TPayload>>(config.table)
                    .get(job.payload.localId);
                if (!current)
                    throw new Error(
                        `Local ${config.table} record ${job.payload.localId} was not found.`,
                    );
                const now = Date.now();
                const resolvedPayload = {
                    ...(result.payload ?? current.payload),
                    id: result.serverId,
                } as TPayload;
                const resolvedRecord: LocalRecord<TPayload> = {
                    ...current,
                    remoteId: result.serverId,
                    payload: resolvedPayload,
                    serverVersion:
                        result.serverVersion ?? current.serverVersion,
                    syncStatus: "SYNCED",
                    updatedAt: now,
                };
                const resolvedJob: LocalRecord<TableOutboxPayload> = {
                    ...job,
                    remoteId: result.serverId,
                    payload: { ...job.payload, serverId: result.serverId },
                    syncStatus: "SYNCED",
                    updatedAt: now,
                };
                const dependentJobs = jobs
                    .filter((candidate) =>
                        candidate.payload.dependencyJobIds?.includes(
                            result.jobId,
                        ),
                    )
                    .map((candidate) => ({
                        ...candidate,
                        payload: {
                            ...candidate.payload,
                            data: replaceId(
                                candidate.payload.data,
                                job.payload.localId,
                                result.serverId,
                            ) as Record<string, unknown>,
                        },
                        updatedAt: now,
                    }));
                const dependentTables = dependentJobs.map(
                    (candidate) => candidate.payload.table,
                );
                const collections = [
                    ...new Set<CollectionName>([
                        config.table,
                        ...dependentTables,
                        "sync_outbox",
                        "sync_dependencies",
                    ]),
                ];
                const dependentRecords = (
                    await Promise.all(
                        dependentJobs.map(async (candidate) => {
                            const repository = database.collection<
                                LocalRecord<Record<string, unknown>>
                            >(candidate.payload.table);
                            const record = await repository.get(
                                candidate.payload.localId,
                            );
                            return record
                                ? {
                                      table: candidate.payload.table,
                                      record: {
                                          ...record,
                                          payload: replaceId(
                                              record.payload,
                                              job.payload.localId,
                                              result.serverId,
                                          ) as Record<string, unknown>,
                                          updatedAt: now,
                                      },
                                  }
                                : undefined;
                        }),
                    )
                ).filter((item): item is NonNullable<typeof item> =>
                    Boolean(item),
                );
                await database.transaction(collections, async () => {
                    await database
                        .collection<LocalRecord<TPayload>>(config.table)
                        .put(resolvedRecord);
                    await database
                        .collection<LocalRecord<TableOutboxPayload>>(
                            "sync_outbox",
                        )
                        .put(resolvedJob);
                    await database
                        .collection<LocalRecord<TableOutboxPayload>>(
                            "sync_outbox",
                        )
                        .putMany(dependentJobs);
                    for (const dependent of dependentRecords) {
                        await database
                            .collection<LocalRecord<Record<string, unknown>>>(
                                dependent.table,
                            )
                            .put(dependent.record);
                    }
                    const dependencies = await database
                        .collection<LocalRecord<DependencyPayload>>(
                            "sync_dependencies",
                        )
                        .list({ includeDeleted: true });
                    await database
                        .collection<LocalRecord<DependencyPayload>>(
                            "sync_dependencies",
                        )
                        .putMany(
                            dependencies
                                .filter(
                                    (dependency) =>
                                        dependency.payload.dependsOnJobId ===
                                        result.jobId,
                                )
                                .map((dependency) => ({
                                    ...dependency,
                                    syncStatus: "SYNCED",
                                    updatedAt: now,
                                })),
                        );
                });
                return resolvedRecord;
            },
            [database, local.status],
        );

        return {
            data: table.records,
            error: table.error || outbox.error || dependencyRows.error,
            loading:
                local.status === "initializing" ||
                table.loading ||
                outbox.loading ||
                dependencyRows.loading ||
                updatingIds.size > 0,
            updating: updatingIds.size > 0,
            updatingIds,
            pendingMutations,
            readyMutations,
            query,
            reload: table.reload,
            createMutation,
            resolveMutation,
        };
    };
}
