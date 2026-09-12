import { IndexedDbLocalDatabase } from "@indyzai/pos-database/indexeddb";
import type { DatabaseScope, LocalDatabase } from "../types";

export async function createLocalDatabase(
    scope: DatabaseScope,
): Promise<LocalDatabase> {
    const databaseName =
        scope.appProfile === "admin"
            ? "indyz-pos-admin-local-v1"
            : "indyz-pos-local-v1";
    const database = new IndexedDbLocalDatabase(scope, databaseName);
    await database.initialize();
    return database;
}
