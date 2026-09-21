import { useCallback, useEffect, useState } from "react";
import { useLocalDatabase } from "./react";
import type { CollectionName, LocalQuery, LocalRecord } from "./types";

export function useLocalCollection<T extends LocalRecord = LocalRecord>(
    name: CollectionName,
    query: LocalQuery = {},
) {
    const { database, status } = useLocalDatabase();
    const [records, setRecords] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const { storeId, syncStatus, includeDeleted, limit } = query;
    const reload = useCallback(async () => {
        if (!database || status !== "ready") {
            setRecords([]);
            setLoading(status === "initializing");
            return;
        }
        setLoading(true);
        try {
            setRecords(
                await database
                    .collection<T>(name)
                    .list({ storeId, syncStatus, includeDeleted, limit }),
            );
            setError("");
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : `Unable to read ${name}.`,
            );
        } finally {
            setLoading(false);
        }
    }, [database, includeDeleted, limit, name, status, storeId, syncStatus]);
    useEffect(() => {
        if (!database || status !== "ready") {
            void reload();
            return;
        }
        const unsubscribe = database
            .collection<T>(name)
            .subscribe(() => void reload());
        void reload();
        return unsubscribe;
    }, [database, name, reload, status]);
    return { records, loading, error, reload };
}
