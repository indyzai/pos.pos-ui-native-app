import type { LocalDatabase } from "../types";

let activeDatabase: LocalDatabase | null = null;
const waiters: Array<(db: LocalDatabase) => void> = [];

export const setActiveDatabase = (database: LocalDatabase | null): void => {
    activeDatabase = database;
    if (database) {
        const toNotify = waiters.splice(0, waiters.length);
        for (const notify of toNotify) {
            try {
                notify(database);
            } catch {
                // ignore error in listener
            }
        }
    }
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

export async function waitForActiveDatabase(timeoutMs = 1500): Promise<LocalDatabase> {
    if (activeDatabase) return activeDatabase;
    return new Promise((resolve, reject) => {
        let callback: ((db: LocalDatabase) => void) | null = null;
        const timer = setTimeout(() => {
            if (callback) {
                const index = waiters.indexOf(callback);
                if (index !== -1) waiters.splice(index, 1);
            }
            reject(new Error("The local web database is not ready."));
        }, timeoutMs);

        callback = (db) => {
            clearTimeout(timer);
            resolve(db);
        };
        waiters.push(callback);
    });
}
