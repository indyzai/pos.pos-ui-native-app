import type {
    EntityContext,
    LocalMutation,
    OfflineRepository,
    OfflineSyncAdapter,
} from "./types";

export type SyncCoordinator = {
    syncRecord(args: { tableName: string; id: string }): Promise<void>;
    syncPending(args: EntityContext & { tableName: string }): Promise<void>;
};

export function createSyncCoordinator<T, TCreate, TUpdate, TFilter>(options: {
    repository: OfflineRepository<T, TFilter>;
    adapter: OfflineSyncAdapter<T, TCreate, TUpdate, TFilter>;
    context: EntityContext;
    tableName: string;
    online?: () => boolean;
}): SyncCoordinator {
    const { repository, adapter, context, tableName } = options;
    const inFlight = new Map<string, Promise<void>>();
    const ordered = (jobs: LocalMutation[]) =>
        jobs.sort(
            (left, right) =>
                left.createdAt - right.createdAt ||
                { CREATE: 0, UPDATE: 1, DELETE: 2 }[left.type] -
                    { CREATE: 0, UPDATE: 1, DELETE: 2 }[right.type] ||
                left.id.localeCompare(right.id),
        );

    async function replay(job: LocalMutation): Promise<void> {
        if (options.online?.() === false) return;
        const record = await repository.getById({
            ...context,
            tableName,
            id: job.recordId,
        });
        if (!record) return;
        const send =
            job.type === "CREATE"
                ? adapter.create?.({
                      record,
                      input: job.input as TCreate,
                      idempotencyKey: job.idempotencyKey,
                  })
                : job.type === "UPDATE"
                  ? adapter.update?.({
                        record,
                        input: job.input as TUpdate,
                        idempotencyKey: job.idempotencyKey,
                        expectedVersion: record.serverVersion,
                    })
                  : adapter.delete?.({
                        record,
                        idempotencyKey: job.idempotencyKey,
                        expectedVersion: record.serverVersion,
                    });
        if (!send) return;
        await repository.updateMutation(job.id, {
            status: "SYNCING",
            updatedAt: Date.now(),
        });
        await repository.updateRecord(tableName, record.id, {
            syncStatus: "SYNCING",
        });
        try {
            const remote = await send;
            await repository.acknowledgeMutation(job, remote);
        } catch (reason) {
            const error = reason as { code?: string; message?: string };
            const conflict =
                error.code === "CONFLICT" ||
                error.code === "IDEMPOTENCY_CONFLICT" ||
                error.code === "UNCERTAIN_OUTCOME";
            const status = conflict ? "CONFLICT" : "FAILED";
            await repository.updateMutation(job.id, {
                status,
                retryCount: job.retryCount + 1,
                updatedAt: Date.now(),
                error: error.message ?? String(reason),
            });
            await repository.updateRecord(tableName, record.id, {
                syncStatus: status,
            });
            throw reason;
        }
    }

    function runOnce(job: LocalMutation): Promise<void> {
        const existing = inFlight.get(job.id);
        if (existing) return existing;
        const work = replay(job).finally(() => inFlight.delete(job.id));
        inFlight.set(job.id, work);
        return work;
    }

    return {
        async syncRecord({ tableName: requestedTable, id }) {
            if (requestedTable !== tableName)
                throw new Error("Wrong entity table.");
            const jobs = await repository.listMutations({
                ...context,
                tableName,
                recordId: id,
            });
            for (const job of ordered(jobs).filter(
                (item) => item.status === "PENDING" || item.status === "FAILED",
            ))
                await runOnce(job);
        },
        async syncPending(args) {
            if (
                args.tableName !== tableName ||
                args.scope !== context.scope ||
                args.tenantId !== context.tenantId ||
                args.storeId !== context.storeId
            )
                throw new Error("Wrong entity scope.");
            const jobs = await repository.listMutations({
                ...context,
                tableName,
            });
            for (const job of ordered(jobs).filter(
                (item) => item.status === "PENDING" || item.status === "FAILED",
            ))
                await runOnce(job);
        },
    };
}
