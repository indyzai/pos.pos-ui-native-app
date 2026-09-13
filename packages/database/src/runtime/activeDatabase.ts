import type { LocalDatabase } from "../types";

let activeDatabase: LocalDatabase | null = null;

export const setActiveDatabase = (database: LocalDatabase | null): void => {
    activeDatabase = database;
};

export const setActiveWebDatabase = setActiveDatabase;

export function getActiveDatabase(): LocalDatabase | null {
    return activeDatabase;
}

export function getActiveDatabaseSafe(): LocalDatabase | null {
    return activeDatabase;
}

export function getActiveWebDatabase(): LocalDatabase {
    if (!activeDatabase) throw new Error("The local web database is not ready.");
    return activeDatabase;
}

export function getActiveWebDatabaseSafe(): LocalDatabase | null {
    return activeDatabase;
}
