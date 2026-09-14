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

export const localSchemaVersion = 3;

const purchaseTablesMigration = `
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id text PRIMARY KEY NOT NULL,
    scope text NOT NULL,
    tenant_id text NOT NULL,
    store_id text,
    purchase_order_id text NOT NULL,
    remote_id text,
    payload text DEFAULT '{}' NOT NULL,
    server_version integer DEFAULT 0 NOT NULL,
    sync_status text DEFAULT 'API' NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
);
CREATE INDEX IF NOT EXISTS purchase_order_lines_scope_parent_idx
    ON purchase_order_lines (scope, purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_lines_tenant_store_idx
    ON purchase_order_lines (tenant_id, store_id);
CREATE TABLE IF NOT EXISTS purchase_orders (
    id text PRIMARY KEY NOT NULL,
    scope text NOT NULL,
    tenant_id text NOT NULL,
    store_id text,
    remote_id text,
    payload text DEFAULT '{}' NOT NULL,
    server_version integer DEFAULT 0 NOT NULL,
    sync_status text DEFAULT 'API' NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
);
CREATE INDEX IF NOT EXISTS purchase_orders_scope_idx ON purchase_orders (scope);
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_store_idx
    ON purchase_orders (tenant_id, store_id);
CREATE INDEX IF NOT EXISTS purchase_orders_scope_updated_idx
    ON purchase_orders (scope, updated_at);
`;
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
    // Store databases created before purchase management was enabled were
    // already marked version 2, so they need the newly provisioned tables via
    // a forward migration. IF NOT EXISTS also makes this safe for admin DBs.
    if (version > 0 && version < 3) {
        sqlite.withTransactionSync(() => {
            sqlite.execSync(purchaseTablesMigration);
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
