import { createLocalFirstTableHook } from "./tableSyncHook";

type QueuePayload = Record<string, unknown>;

const usePendingOutbox = createLocalFirstTableHook<QueuePayload>({
    table: "sync_outbox",
    query: { syncStatus: "PENDING" },
});
const useRunningOutbox = createLocalFirstTableHook<QueuePayload>({
    table: "sync_outbox",
    query: { syncStatus: "RUNNING" },
});

/** Pending durable writes shown globally in the application header. */
export function useOfflineQueueCount(): number {
    const pending = usePendingOutbox();
    const running = useRunningOutbox();
    return pending.data.length + running.data.length;
}
