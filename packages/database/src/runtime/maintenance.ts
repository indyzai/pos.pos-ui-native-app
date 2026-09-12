import type { LocalDatabase } from "../types";
import { getSQLiteClient, hasNativeDatabase } from "./client";
import { initializeDatabase } from "./migrations";

const legacyTables = ["billing_metadata", "sync_jobs"] as const;

/** Clears offline business data without removing authentication or device registration. */
export async function clearLocalUiData(
    database?: LocalDatabase | null,
): Promise<void> {
    if (!hasNativeDatabase) {
        const { clearWebLocalData } = await import("./webClient");
        await Promise.all([clearWebLocalData(), database?.clear()]);
        return;
    }
    initializeDatabase();
    await database?.clear();
    const sqlite = getSQLiteClient();
    sqlite.withTransactionSync(() => {
        for (const table of legacyTables)
            sqlite.runSync(`DELETE FROM "${table}"`);
    });
}
