import { useCallback, useMemo } from "react";
import { useLocalCollection } from "./hooks";
import { useLocalDatabase } from "./react";
import { type LocalQuery, type LocalRecord } from "./types";

import {
    createTableMutation,
    resolveTableMutation,
    type CreateTableMutation,
    type ResolveTableMutation,
    type TableOutboxPayload,
    type LocalFirstTableHookConfig,
    type DependencyPayload,
} from "./tableMutations";
export type {
    MutationDependency,
    CreateTableMutation,
    ResolveTableMutation,
    TableOutboxPayload,
    LocalFirstTableHookConfig,
} from "./tableMutations";

/**
 * Creates a feature hook backed only by a local table and the shared sync outbox.
 * API workers resolve mutations with `resolveMutation`; UI code never waits on the API directly.
 */
export function createLocalFirstTableHook<
    TPayload extends Record<string, unknown>,
>(config: LocalFirstTableHookConfig<TPayload>) {
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
                return createTableMutation(database, config, input);
            },
            [database, local.status],
        );

        const resolveMutation = useCallback(
            async (result: ResolveTableMutation<TPayload>) => {
                if (!database || local.status !== "ready")
                    throw new Error("The local database is not ready.");
                return resolveTableMutation(database, config, result);
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
