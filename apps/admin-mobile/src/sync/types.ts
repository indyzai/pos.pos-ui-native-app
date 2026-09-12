export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/** Shared shape for mutations that must survive loss of connectivity. */
export type QueuedMutation<TPayload> = {
    id: string;
    operation: SyncOperation;
    payload: TPayload;
    createdAt: string;
    error?: string;
};
