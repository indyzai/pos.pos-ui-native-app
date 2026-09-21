import type { LocalDatabase, LocalRecord } from '@indyzai/pos-database';
import { createLogger } from '@indyzai/pos-utils';
import { billingApi } from './billingApi';

const logger = createLogger('Billing:outbox-worker');
const minimumRetryMs = 1_000;
const maximumRetryMs = 60_000;

type OutboxPayload = { entityType?: string };
export type BillingOutboxRunResult = 'synced' | 'offline' | 'empty' | 'busy';
type BillingOutboxWorker = {
  database: LocalDatabase;
  wake: () => void;
  runNow: () => Promise<BillingOutboxRunResult>;
  stop: () => void;
};
let activeWorker: BillingOutboxWorker | undefined;

/** Watches the durable sale outbox and serially pushes it whenever work appears. */
export function startBillingOutboxWorker(
  database: LocalDatabase,
  sync: () => Promise<void> = () => billingApi.sync(),
  isOnline: () => Promise<boolean> = async () => true,
) {
  if (activeWorker?.database === database) return activeWorker;
  activeWorker?.stop();
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = minimumRetryMs;

  const schedule = (delayMs = 0) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void drain().catch(() => undefined);
    }, delayMs);
  };

  const hasPendingSales = async () => {
    const records = await database
      .collection<LocalRecord<OutboxPayload>>('sync_outbox')
      .list({ syncStatus: 'PENDING', includeDeleted: true });
    return records.some((record) => record.payload.entityType === 'SALE');
  };

  const drain = async (): Promise<BillingOutboxRunResult> => {
    if (stopped || running) return 'busy';
    if (!(await hasPendingSales())) return 'empty';
    running = true;
    try {
      if (!(await isOnline())) {
        logger.info('Sale outbox is waiting for network connectivity');
        return 'offline';
      }
      await sync();
      retryMs = minimumRetryMs;
      if (await hasPendingSales()) schedule();
      return 'synced';
    } catch (error) {
      logger.warn('Sale outbox push deferred', {
        retryMs,
        error: error instanceof Error ? error.message : String(error),
      });
      schedule(retryMs);
      retryMs = Math.min(retryMs * 2, maximumRetryMs);
      throw error;
    } finally {
      running = false;
    }
  };

  const unsubscribe = database.collection('sync_outbox').subscribe(() => schedule(50));
  schedule();
  const worker: BillingOutboxWorker = {
    database,
    wake: () => schedule(),
    runNow: () => drain(),
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      if (activeWorker === worker) activeWorker = undefined;
    },
  };
  activeWorker = worker;
  return worker;
}

/** Triggers the one global worker without creating another processor. */
export function triggerBillingOutboxWorker(): Promise<BillingOutboxRunResult> {
  return activeWorker?.runNow() ?? Promise.resolve('empty');
}

export function wakeBillingOutboxWorker() {
  activeWorker?.wake();
}

export function stopBillingOutboxWorker(database?: LocalDatabase) {
  if (!database || activeWorker?.database === database) activeWorker?.stop();
}
