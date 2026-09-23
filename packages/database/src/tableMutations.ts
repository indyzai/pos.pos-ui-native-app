import {
    createScopeKey,
    type CollectionName,
    type LocalDatabase,
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
    errorMessage?: string;
    attempts?: number;
};

export type DependencyPayload = { jobId: string; dependsOnJobId: string };

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

export async function createTableMutation<
    TPayload extends Record<string, unknown>,
>(
    database: LocalDatabase,
    config: LocalFirstTableHookConfig<TPayload>,
    input: CreateTableMutation<TPayload>,
) {
    const entityType = config.entityType ?? config.table.toUpperCase();
    const now = Date.now();
    const scope = createScopeKey(database.scope);
    const localId = input.localId ?? identifier();
    const jobId = identifier();
    const previousJobs = input.localId
        ? await database
              .collection<LocalRecord<TableOutboxPayload>>("sync_outbox")
              .list({ includeDeleted: true })
        : [];
    const predecessors = previousJobs.filter(
        (job) =>
            job.payload.table === config.table &&
            job.payload.localId === localId &&
            job.syncStatus !== "SYNCED",
    );
    const dependencies = [
        ...predecessors.map((job) => ({ jobId: job.payload.offlineId })),
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
        `${entityType}:${localId}:${input.operation}:${jobId}`;
    const current = input.localId
        ? await database
              .collection<LocalRecord<TPayload>>(config.table)
              .get(input.localId)
        : undefined;
    const record: LocalRecord<TPayload> = {
        id: localId,
        scope,
        tenantId: database.scope.tenantId,
        storeId: input.storeId ?? database.scope.storeIds[0] ?? null,
        remoteId: current?.remoteId ?? null,
        payload: {
            ...current?.payload,
            ...input.payload,
            id: current?.remoteId ?? localId,
        },
        serverVersion: input.baseServerVersion ?? current?.serverVersion ?? 0,
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
        dependencyJobIds: dependencies.map((dependency) => dependency.jobId),
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
    const dependencyRecords = dependencies.map<LocalRecord<DependencyPayload>>(
        (dependency) => ({
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
        }),
    );
    await database.transaction(
        [config.table, "sync_outbox", "sync_dependencies"],
        async () => {
            await database
                .collection<LocalRecord<TPayload>>(config.table)
                .put(record);
            await database
                .collection<LocalRecord<TableOutboxPayload<TPayload>>>(
                    "sync_outbox",
                )
                .put(job);
            await database
                .collection<LocalRecord<DependencyPayload>>("sync_dependencies")
                .putMany(dependencyRecords);
        },
    );
    return { record, job, dependencies: dependencyRecords };
}

export async function resolveTableMutation<
    TPayload extends Record<string, unknown>,
>(
    database: LocalDatabase,
    config: LocalFirstTableHookConfig<TPayload>,
    result: ResolveTableMutation<TPayload>,
) {
    const jobs = await database
        .collection<LocalRecord<TableOutboxPayload>>("sync_outbox")
        .list({ includeDeleted: true });
    const job = jobs.find(
        (candidate) => candidate.payload.offlineId === result.jobId,
    );
    if (!job) throw new Error(`Outbox mutation ${result.jobId} was not found.`);
    if (job.payload.table !== config.table)
        throw new Error("The mutation belongs to a different table.");
    const current = await database
        .collection<LocalRecord<TPayload>>(config.table)
        .get(job.payload.localId);
    if (!current)
        throw new Error(
            `Local ${config.table} record ${job.payload.localId} was not found.`,
        );
    const now = Date.now();
    const outstanding = jobs.filter(
        (candidate) =>
            candidate.id !== job.id &&
            candidate.payload.table === config.table &&
            candidate.payload.localId === job.payload.localId &&
            candidate.syncStatus !== "SYNCED",
    );
    const resolvedPayload = {
        ...(outstanding.length
            ? current.payload
            : (result.payload ?? current.payload)),
        id: result.serverId,
    } as TPayload;
    const resolvedRecord: LocalRecord<TPayload> = {
        ...current,
        remoteId: result.serverId,
        payload: resolvedPayload,
        serverVersion: result.serverVersion ?? current.serverVersion,
        syncStatus: outstanding.length ? "PENDING" : "SYNCED",
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
            candidate.payload.dependencyJobIds?.includes(result.jobId),
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
                const record = await repository.get(candidate.payload.localId);
                return record
                    ? {
                          table: candidate.payload.table,
                          record: {
                              ...(candidate.payload.table === config.table &&
                              record.id === current.id
                                  ? resolvedRecord
                                  : record),
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
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    await database.transaction(collections, async () => {
        await database
            .collection<LocalRecord<TPayload>>(config.table)
            .put(resolvedRecord);
        await database
            .collection<LocalRecord<TableOutboxPayload>>("sync_outbox")
            .put(resolvedJob);
        await database
            .collection<LocalRecord<TableOutboxPayload>>("sync_outbox")
            .putMany(dependentJobs);
        for (const dependent of dependentRecords) {
            await database
                .collection<LocalRecord<Record<string, unknown>>>(
                    dependent.table,
                )
                .put(dependent.record);
        }
        const dependencies = await database
            .collection<LocalRecord<DependencyPayload>>("sync_dependencies")
            .list({ includeDeleted: true });
        await database
            .collection<LocalRecord<DependencyPayload>>("sync_dependencies")
            .putMany(
                dependencies
                    .filter(
                        (dependency) =>
                            dependency.payload.dependsOnJobId === result.jobId,
                    )
                    .map((dependency) => ({
                        ...dependency,
                        syncStatus: "SYNCED",
                        updatedAt: now,
                    })),
            );
    });
    return resolvedRecord;
}
