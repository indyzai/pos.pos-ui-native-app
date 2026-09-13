import type { LocalDatabase } from "../types";
let activeDatabase: LocalDatabase | null = null;
export const setActiveWebDatabase = (database: LocalDatabase | null): void => { activeDatabase = database; };
export function getActiveWebDatabase(): LocalDatabase {
    if (!activeDatabase) throw new Error("The local web database is not ready.");
    return activeDatabase;
}
