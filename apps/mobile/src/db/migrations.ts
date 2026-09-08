import { getSQLiteClient, hasNativeDatabase } from './client';

let initialized = false;

/** Runs the checked-in schema migration before repositories access the native database. */
export function initializeDatabase(): void {
  if (initialized || !hasNativeDatabase) return;
  getSQLiteClient().execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      scope TEXT NOT NULL,
      remote_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL,
      barcode TEXT,
      tax_rate INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS products_scope_idx ON products (scope);
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      scope TEXT NOT NULL,
      offline_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sales_scope_status_idx ON sales (scope, status);
    CREATE TABLE IF NOT EXISTS billing_metadata (
      id TEXT PRIMARY KEY NOT NULL,
      scope TEXT NOT NULL,
      session TEXT NOT NULL,
      updated TEXT
    );
    CREATE INDEX IF NOT EXISTS billing_metadata_scope_idx ON billing_metadata (scope);
  `);
  initialized = true;
}
