import { initialSchemaSql } from './initialSchema.generated';
import { getSQLiteClient, hasNativeDatabase } from './client';

export const localSchemaVersion = 1;
let initialized = false;

/** Creates the new-app schema once. Future schema changes must use forward-only migrations. */
export function initializeDatabase(): void {
  if (initialized || !hasNativeDatabase) return;
  const sqlite = getSQLiteClient();
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version > localSchemaVersion) {
    throw new Error(`Local database version ${version} is newer than this app supports.`);
  }
  if (version === 0) {
    sqlite.withTransactionSync(() => {
      sqlite.execSync(initialSchemaSql);
      sqlite.execSync(`PRAGMA user_version = ${localSchemaVersion}`);
      sqlite.runSync(
        `INSERT OR REPLACE INTO schema_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
        'schemaVersion',
        String(localSchemaVersion),
        Date.now(),
      );
    });
  }
  initialized = true;
}
