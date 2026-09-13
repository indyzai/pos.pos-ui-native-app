import type { DatabaseScope, LocalDatabase } from "./types";
import { createLocalDatabase } from "./runtime/localDatabase.web";

export async function createAdminLocalDatabase(
    scope: DatabaseScope,
): Promise<LocalDatabase> {
    return createLocalDatabase({ ...scope, appProfile: "admin" });
}
