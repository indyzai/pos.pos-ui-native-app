import { getActiveDatabase, waitForActiveDatabase } from './runtime/activeDatabase';
import { createScopeKey, type LocalDatabase, type LocalRecord, type SyncStatus } from './types';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type QueuedMutation<TPayload> = {
  id: string;
  operation: SyncOperation;
  payload: TPayload;
  createdAt: string;
  error?: string;
};

export type OutboxJobOperation = 'CREATE_PRODUCT' | 'UPDATE_STOCK';
export type OutboxJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type OutboxJob = {
  id: string;
  scope: string;
  operation: OutboxJobOperation;
  entityId?: string;
  status: OutboxJobStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type InventoryOutboxPayload = OutboxJob & {
  entityType: 'INVENTORY_ACTION';
  offlineId: string;
  idempotencyKey: string;
};

function generateUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  try {
    const Crypto = require('expo-crypto');
    return Crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = (Math.random() * 16) | 0;
      return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  }
}

async function database(): Promise<LocalDatabase> {
  return getActiveDatabase() ?? waitForActiveDatabase(1500);
}

function syncStatus(status: OutboxJobStatus): SyncStatus {
  return status === 'COMPLETED' ? 'SYNCED' : status;
}

function toRecord(db: LocalDatabase, job: OutboxJob): LocalRecord<InventoryOutboxPayload> {
  const payload: InventoryOutboxPayload = {
    ...job,
    entityType: 'INVENTORY_ACTION',
    offlineId: job.id,
    idempotencyKey: job.id,
  };
  return {
    id: `${createScopeKey(db.scope)}:sync_outbox:${job.id}`,
    scope: createScopeKey(db.scope),
    tenantId: db.scope.tenantId,
    storeId: db.scope.storeIds[0] ?? null,
    remoteId: job.entityId ?? null,
    payload,
    serverVersion: 0,
    syncStatus: syncStatus(job.status),
    updatedAt: Date.parse(job.updatedAt),
    deletedAt: null,
  };
}

export async function createOutboxJob(scope: string, operation: OutboxJobOperation): Promise<OutboxJob> {
  const now = new Date().toISOString();
  const job: OutboxJob = { id: generateUUID(), scope, operation, status: 'PENDING', createdAt: now, updatedAt: now };
  await saveOutboxJob(job);
  return job;
}

export async function saveOutboxJob(job: OutboxJob): Promise<void> {
  const db = await database();
  await db.collection<LocalRecord<InventoryOutboxPayload>>('sync_outbox').put(toRecord(db, job));
}

export async function updateOutboxJob(
  job: OutboxJob,
  status: OutboxJobStatus,
  values: Partial<Pick<OutboxJob, 'entityId' | 'errorMessage'>> = {},
): Promise<OutboxJob> {
  const updated = { ...job, ...values, status, updatedAt: new Date().toISOString() };
  await saveOutboxJob(updated);
  return updated;
}

export async function listOutboxJobs(_scope: string): Promise<OutboxJob[]> {
  const db = await database();
  const records = await db.collection<LocalRecord<InventoryOutboxPayload>>('sync_outbox').list({ includeDeleted: true });
  return records
    .filter((record) => record.payload.entityType === 'INVENTORY_ACTION')
    .map((record) => record.payload)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 20);
}
