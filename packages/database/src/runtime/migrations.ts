import { initialSchemaSql } from "./initialSchema.generated";
import {
    getConfiguredDatabaseProfile,
    getSQLiteClient,
    hasNativeDatabase,
} from "./client";
import {
    schemaSqlForProfile,
    type DatabaseAppProfile,
} from "@indyzai/pos-database";

export const localSchemaVersion = 2;
const initializedProfiles = new Set<DatabaseAppProfile>();

/** Creates the new-app schema once. Future schema changes must use forward-only migrations. */
export function initializeDatabase(
    profile: DatabaseAppProfile = getConfiguredDatabaseProfile(),
): void {
    if (initializedProfiles.has(profile) || !hasNativeDatabase) return;
    const sqlite = getSQLiteClient();
    sqlite.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const version =
        sqlite.getFirstSync<{ user_version: number }>("PRAGMA user_version")
            ?.user_version ?? 0;
    if (version > localSchemaVersion) {
        throw new Error(
            `Local database version ${version} is newer than this app supports.`,
        );
    }
    if (version === 0) {
        sqlite.withTransactionSync(() => {
            sqlite.execSync(schemaSqlForProfile(initialSchemaSql, profile));
            sqlite.execSync(`PRAGMA user_version = ${localSchemaVersion}`);
            sqlite.runSync(
                `INSERT OR REPLACE INTO schema_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
                "schemaVersion",
                String(localSchemaVersion),
                Date.now(),
            );
        });
    }
    if (version > 0 && version < 2) {
        sqlite.withTransactionSync(() => {
            sqlite.execSync("DROP TABLE IF EXISTS sync_jobs");
            sqlite.execSync(`PRAGMA user_version = ${localSchemaVersion}`);
            sqlite.runSync(
                `INSERT OR REPLACE INTO schema_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
                "schemaVersion",
                String(localSchemaVersion),
                Date.now(),
            );
        });
    }
    initializedProfiles.add(profile);
}
