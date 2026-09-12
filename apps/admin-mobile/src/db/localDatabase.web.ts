import { IndexedDbLocalDatabase } from '@indyzai/pos-database/indexeddb';
import type { DatabaseScope, LocalDatabase } from './types';

export async function createLocalDatabase(scope: DatabaseScope): Promise<LocalDatabase> {
    const database = new IndexedDbLocalDatabase(scope, 'indyz-pos-admin-local-v1');
    await database.initialize();
    return database;
}
