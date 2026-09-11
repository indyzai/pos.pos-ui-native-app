import { SqliteLocalDatabase } from './adapters/sqlite/sqlite.database';
import type { DatabaseScope, LocalDatabase } from './types';

export async function createLocalDatabase(scope: DatabaseScope): Promise<LocalDatabase> {
  const database = new SqliteLocalDatabase(scope);
  await database.initialize();
  return database;
}
