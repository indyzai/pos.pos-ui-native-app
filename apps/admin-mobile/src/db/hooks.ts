import { useCallback, useEffect, useState } from 'react';
import { useLocalDatabase } from './DatabaseProvider';
import type { CollectionName, LocalQuery, LocalRecord } from './types';

export function useLocalCollection<T extends LocalRecord = LocalRecord>(
    name: CollectionName,
    query: LocalQuery = {},
) {
    const { database, status } = useLocalDatabase();
    const [records, setRecords] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { storeId, syncStatus, includeDeleted, limit } = query;
    const reload = useCallback(async () => {
        if (!database || status !== 'ready') {
            setRecords([]);
            setLoading(status === 'initializing');
            return;
        }
        setLoading(true);
        try {
            setRecords(
                await database.collection<T>(name).list({ storeId, syncStatus, includeDeleted, limit }),
            );
            setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : `Unable to read ${name}.`);
        } finally {
            setLoading(false);
        }
    }, [database, includeDeleted, limit, name, status, storeId, syncStatus]);
    useEffect(() => {
        if (!database || status !== 'ready') {
            void reload();
            return;
        }
        const unsubscribe = database.collection<T>(name).subscribe(() => void reload());
        void reload();
        return unsubscribe;
    }, [database, name, reload, status]);
    return { records, loading, error, reload };
}

export function useLocalRecord<T extends LocalRecord = LocalRecord>(name: CollectionName, id?: string) {
    const { database, status } = useLocalDatabase();
    const [record, setRecord] = useState<T>();
    const [loading, setLoading] = useState(Boolean(id));
    const [error, setError] = useState('');
    const reload = useCallback(async () => {
        if (!database || status !== 'ready' || !id) {
            setRecord(undefined);
            setLoading(status === 'initializing');
            return;
        }
        setLoading(true);
        try {
            setRecord(await database.collection<T>(name).get(id));
            setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : `Unable to read ${name}.`);
        } finally {
            setLoading(false);
        }
    }, [database, id, name, status]);
    useEffect(() => {
        if (!database || status !== 'ready') {
            void reload();
            return;
        }
        const unsubscribe = database.collection<T>(name).subscribe(() => void reload());
        void reload();
        return unsubscribe;
    }, [database, name, reload, status]);
    return { record, loading, error, reload };
}

export const useLocalProducts = <T extends LocalRecord = LocalRecord>(query?: LocalQuery) =>
    useLocalCollection<T>('products', query);
export const useLocalCustomers = <T extends LocalRecord = LocalRecord>(query?: LocalQuery) =>
    useLocalCollection<T>('customers', query);
export const useLocalSales = <T extends LocalRecord = LocalRecord>(query?: LocalQuery) =>
    useLocalCollection<T>('sales', query);
export const useLocalPayments = <T extends LocalRecord = LocalRecord>(query?: LocalQuery) =>
    useLocalCollection<T>('payments', query);
export const useLocalStockBalances = <T extends LocalRecord = LocalRecord>(query?: LocalQuery) =>
    useLocalCollection<T>('stock_balances', query);
export const usePendingSync = <T extends LocalRecord = LocalRecord>() =>
    useLocalCollection<T>('sync_outbox', { syncStatus: 'PENDING' });
