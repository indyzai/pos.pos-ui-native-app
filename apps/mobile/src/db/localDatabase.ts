import { SqliteLocalDatabase } from './adapters/sqlite/sqlite.database';
import type { DatabaseScope, LocalDatabase } from './types';
import { createSqliteLocalDatabase } from '@indyzai/pos-database/sqlite';

export async function createLocalDatabase(scope: DatabaseScope): Promise<LocalDatabase> {
  return createSqliteLocalDatabase(scope, async (databaseScope) => {
    const database = new SqliteLocalDatabase(databaseScope);
    await database.initialize();
    return database;
  });
}
