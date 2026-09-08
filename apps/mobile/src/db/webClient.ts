import type { BillingSnapshot } from '../features/billing/data/billingRepository';

const databaseName = 'indyz-pos-web';
const storeName = 'billing-snapshots';
let databasePromise: Promise<IDBDatabase> | undefined;

export function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onerror = () => reject(request.error ?? new Error('Unable to open browser storage.'));
      request.onblocked = () => reject(new Error('Close other POS tabs and retry local storage.'));
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
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

export async function readWebBillingSnapshot(scope: string): Promise<BillingSnapshot | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(scope);
    request.onerror = () => reject(request.error ?? new Error('Unable to read browser storage.'));
    request.onsuccess = () => resolve(request.result as BillingSnapshot | undefined);
  });
}

export async function writeWebBillingSnapshot(scope: string, snapshot: BillingSnapshot): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write browser storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage write was aborted.'));
    transaction.oncomplete = () => resolve();
    transaction.objectStore(storeName).put(snapshot, scope);
  });
}
