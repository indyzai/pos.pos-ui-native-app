import * as Crypto from 'expo-crypto';
import { desc, eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../db/client';
import { initializeDatabase } from '../db/migrations';
import { syncJobs, type SyncJobOperation, type SyncJobStatus } from '../db/schema/syncJobs';
import { readWebSyncJobs, writeWebSyncJob } from '../db/webClient';

export type SyncJob = {
    id: string;
    scope: string;
    operation: SyncJobOperation;
    entityId?: string;
    status: SyncJobStatus;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
};

export async function createSyncJob(scope: string, operation: SyncJobOperation): Promise<SyncJob> {
    const now = new Date().toISOString();
    const job: SyncJob = {
        id: Crypto.randomUUID(),
        scope,
        operation,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
    };
    await saveSyncJob(job);
    return job;
}

export async function saveSyncJob(job: SyncJob): Promise<void> {
    if (!hasNativeDatabase) {
        await writeWebSyncJob({ ...job, storageId: `${job.scope}:sync-job:${job.id}` });
        return;
    }
    initializeDatabase();
    getDatabase()
        .insert(syncJobs)
        .values({ ...job, entityId: job.entityId ?? null, errorMessage: job.errorMessage ?? null })
        .onConflictDoUpdate({
            target: syncJobs.id,
            set: {
                entityId: job.entityId ?? null,
                status: job.status,
                errorMessage: job.errorMessage ?? null,
                updatedAt: job.updatedAt,
            },
        })
        .run();
}

export async function updateSyncJob(
    job: SyncJob,
    status: SyncJobStatus,
    values: Partial<Pick<SyncJob, 'entityId' | 'errorMessage'>> = {},
): Promise<SyncJob> {
    const updated = { ...job, ...values, status, updatedAt: new Date().toISOString() };
    await saveSyncJob(updated);
    return updated;
}

export async function listSyncJobs(scope: string): Promise<SyncJob[]> {
    if (!hasNativeDatabase) {
        const rows = await readWebSyncJobs(scope);
        return rows
            .map(({ storageId: _storageId, ...job }) => job)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .slice(0, 20);
    }
    initializeDatabase();
    return getDatabase()
        .select()
        .from(syncJobs)
        .where(eq(syncJobs.scope, scope))
        .orderBy(desc(syncJobs.updatedAt))
        .limit(20)
        .all()
        .map((job) => ({
            ...job,
            entityId: job.entityId ?? undefined,
            errorMessage: job.errorMessage ?? undefined,
        }));
}
