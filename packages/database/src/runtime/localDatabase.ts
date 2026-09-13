import { SqliteLocalDatabase } from "./adapters/sqlite/sqlite.database";
import type { DatabaseScope, LocalDatabase } from "../types";
import { createSqliteLocalDatabase } from "@indyzai/pos-database/sqlite";
import { configureDatabaseProfile } from "./client";
import { setActiveDatabase } from "./activeDatabase";

export async function createLocalDatabase(
    scope: DatabaseScope,
): Promise<LocalDatabase> {
    configureDatabaseProfile(scope.appProfile ?? "store");
    const database = await createSqliteLocalDatabase(scope, async (databaseScope) => {
        const db = new SqliteLocalDatabase(databaseScope);
        await db.initialize();
        return db;
    });
    setActiveDatabase(database);
    return database;
}
