import type { CollectionName, DatabaseScope, LocalDatabase } from "../types";

/**
 * Dependencies supplied by an Expo/native app to create its SQLite-backed database.
 * Keeping schema initialization app-owned lets multiple apps share the database API
 * while evolving their own forward-only migrations safely.
 */
export type SqliteDatabaseFactory = (
    scope: DatabaseScope,
) => Promise<LocalDatabase>;

export async function createSqliteLocalDatabase(
    scope: DatabaseScope,
    factory: SqliteDatabaseFactory,
): Promise<LocalDatabase> {
    const database = await factory(scope);
    const verify: readonly CollectionName[] = [];
    await database.transaction(verify, () => undefined);
    return database;
}
