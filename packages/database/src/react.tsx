import { createContext, useContext, type ReactNode } from "react";
import type { DatabaseScope, LocalDatabase } from "./types";

export type DatabaseState = {
    status: "initializing" | "ready" | "error";
    error: string;
    database: LocalDatabase | null;
    scope: DatabaseScope | null;
    retry: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseState | null>(null);

export function LocalDatabaseProvider({
    value,
    children,
}: {
    value: DatabaseState;
    children: ReactNode;
}) {
    return (
        <DatabaseContext.Provider value={value}>
            {children}
        </DatabaseContext.Provider>
    );
}

export function useLocalDatabase(): DatabaseState {
    const state = useContext(DatabaseContext);
    if (!state) throw new Error("LocalDatabaseProvider is required");
    return state;
}

export function useRequiredLocalDatabase(): LocalDatabase {
    const state = useLocalDatabase();
    if (state.status !== "ready" || !state.database)
        throw new Error("The local database is not ready.");
    return state.database;
}
