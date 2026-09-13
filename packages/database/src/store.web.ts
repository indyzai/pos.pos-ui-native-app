import type { DatabaseScope, LocalDatabase } from "./types";
import { createLocalDatabase } from "./runtime/localDatabase.web";

export async function createStoreLocalDatabase(
    scope: DatabaseScope,
): Promise<LocalDatabase> {
    return createLocalDatabase({ ...scope, appProfile: "store" });
}
