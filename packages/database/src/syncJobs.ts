import { desc, eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from './runtime/client';
import { initializeDatabase } from './runtime/migrations';
import { syncJobs, type SyncJobOperation, type SyncJobStatus } from './runtime/schema/index';
import { readWebSyncJobs, writeWebSyncJob } from './runtime/webClient';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/** Shared shape for mutations that must survive loss of connectivity. */
export type QueuedMutation<TPayload> = {
  id: string;
  operation: SyncOperation;
  payload: TPayload;
  createdAt: string;
  error?: string;
};

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

function generateUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  try {
    const Crypto = require('expo-crypto');
    return Crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

export async function createSyncJob(scope: string, operation: SyncJobOperation): Promise<SyncJob> {
  const now = new Date().toISOString();
  const job: SyncJob = {
    id: generateUUID(),
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
