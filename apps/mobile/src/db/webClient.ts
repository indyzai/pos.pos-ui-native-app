import type { BillingSnapshot } from '../features/billing/data/billingRepository';

const databaseName = 'indyz-pos-web';
const legacyStore = 'billing-snapshots';
export const webStores = {
  products: 'products',
  sales: 'sales',
  metadata: 'billing-metadata',
  syncJobs: 'sync-jobs',
} as const;

export type WebSyncJob = {
  storageId: string;
  id: string;
  scope: string;
  operation: 'CREATE_PRODUCT' | 'UPDATE_STOCK';
  entityId?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
let databasePromise: Promise<IDBDatabase> | undefined;

type ScopedProduct = BillingSnapshot['products'][number] & { storageId: string; scope: string };
type ScopedSale = BillingSnapshot['queue'][number] & { storageId: string; scope: string };
type BillingMetadata = Pick<BillingSnapshot, 'session' | 'updated'> & { scope: string };

function addScopeIndex(store: IDBObjectStore) {
  if (!store.indexNames.contains('scope')) store.createIndex('scope', 'scope');
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.onerror = () => reject(request.error ?? new Error('Unable to open browser storage.'));
      request.onblocked = () => reject(new Error('Close other POS tabs and retry local storage.'));
      request.onupgradeneeded = () => {
        const database = request.result;
        const transaction = request.transaction!;
        for (const name of Object.values(webStores)) {
          const store = database.objectStoreNames.contains(name)
            ? transaction.objectStore(name)
            : database.createObjectStore(name, {
                keyPath: name === webStores.metadata ? 'scope' : 'storageId',
              });
          addScopeIndex(store);
        }
        // Preserve version-1 data while moving each collection to its own store.
        if (database.objectStoreNames.contains(legacyStore)) {
          transaction.objectStore(legacyStore).openCursor().onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!cursor) {
              database.deleteObjectStore(legacyStore);
              return;
            }
            const scope = String(cursor.key);
            const snapshot = cursor.value as BillingSnapshot;
            for (const product of snapshot.products ?? [])
              transaction
                .objectStore(webStores.products)
                .put({ ...product, scope, storageId: `${scope}:product:${product.id}` });
            for (const sale of snapshot.queue ?? [])
              transaction
                .objectStore(webStores.sales)
                .put({ ...sale, scope, storageId: `${scope}:sale:${sale.id}` });
            transaction.objectStore(webStores.metadata).put({
              scope,
              session: snapshot.session ?? null,
              updated: snapshot.updated,
            });
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          databasePromise = undefined;
        };
        resolve(request.result);
      };
    }).catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function readByScope<T>(store: IDBObjectStore, scope: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.index('scope').getAll(scope);
    request.onerror = () => reject(request.error ?? new Error('Unable to read browser storage.'));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

export async function readWebBillingSnapshot(scope: string): Promise<BillingSnapshot | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [webStores.products, webStores.sales, webStores.metadata],
    'readonly',
  );
  const [productRows, saleRows, metadata] = await Promise.all([
    readByScope<ScopedProduct>(transaction.objectStore(webStores.products), scope),
    readByScope<ScopedSale>(transaction.objectStore(webStores.sales), scope),
    new Promise<BillingMetadata | undefined>((resolve, reject) => {
      const request = transaction.objectStore(webStores.metadata).get(scope);
      request.onerror = () => reject(request.error ?? new Error('Unable to read billing metadata.'));
      request.onsuccess = () => resolve(request.result as BillingMetadata | undefined);
    }),
  ]);
  if (!metadata && !productRows.length && !saleRows.length) return undefined;
  return {
    products: productRows.map(({ storageId: _storageId, scope: _scope, ...product }) => product),
    queue: saleRows.map(({ storageId: _storageId, scope: _scope, ...sale }) => sale),
    session: metadata?.session ?? null,
    updated: metadata?.updated,
  };
}

export async function writeWebBillingSnapshot(scope: string, snapshot: BillingSnapshot): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [webStores.products, webStores.sales, webStores.metadata],
      'readwrite',
    );
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write browser storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage write was aborted.'));
    transaction.oncomplete = () => resolve();
    const replaceScope = <T extends { id: string }>(
      name: typeof webStores.products | typeof webStores.sales,
      records: T[],
      kind: 'product' | 'sale',
    ) => {
      const store = transaction.objectStore(name);
      const keys = store.index('scope').getAllKeys(scope);
      keys.onsuccess = () => {
        for (const key of keys.result) store.delete(key);
        for (const record of records)
          store.put({ ...record, scope, storageId: `${scope}:${kind}:${record.id}` });
      };
    };
    replaceScope(webStores.products, snapshot.products, 'product');
    replaceScope(webStores.sales, snapshot.queue, 'sale');
    transaction.objectStore(webStores.metadata).put({
      scope,
      session: snapshot.session,
      updated: snapshot.updated,
    });
  });
}

export async function readWebSyncJobs(scope: string): Promise<WebSyncJob[]> {
  const database = await openDatabase();
  const transaction = database.transaction(webStores.syncJobs, 'readonly');
  return readByScope<WebSyncJob>(transaction.objectStore(webStores.syncJobs), scope);
}

export async function writeWebSyncJob(job: WebSyncJob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(webStores.syncJobs, 'readwrite');
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save sync job.'));
    transaction.oncomplete = () => resolve();
    transaction.objectStore(webStores.syncJobs).put(job);
  });
}
