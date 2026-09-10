import { getSQLiteClient, hasNativeDatabase } from './client';
import { initializeDatabase } from './migrations';

/** Clears offline business data without removing authentication or device registration. */
export async function clearLocalUiData(): Promise<void> {
  if (!hasNativeDatabase) {
    const { clearWebLocalData } = await import('./webClient');
    await clearWebLocalData();
    return;
  }
  initializeDatabase();
  getSQLiteClient().execSync(`
    BEGIN IMMEDIATE;
    DELETE FROM products;
    DELETE FROM sales;
    DELETE FROM billing_metadata;
    DELETE FROM sync_jobs;
    COMMIT;
  `);
}
