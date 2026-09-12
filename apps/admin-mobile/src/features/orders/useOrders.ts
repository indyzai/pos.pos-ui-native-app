import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { ordersApi } from './ordersApi';
import type { SalesOrder } from './types';
import type { RefundSelection } from './refundPolicy';
import { payloadsFromRecords, replaceLocalPayloads, useLocalCollection } from '@indyzai/pos-database';
import type { LocalRecord } from '@indyzai/pos-database';
import type { RefundRecord } from './types';

export function useOrders() {
    const auth = useAuthSession();
    const local = useLocalDatabase();
    const [projectionError, setProjectionError] = useState('');
    const client = useQueryClient();
    const ready = !auth.initializing && !!auth.session && local.status === 'ready';
    const key = ['orders', auth.session?.user.id, auth.session?.tenant.id];
    const query = useQuery({
        queryKey: key,
        enabled: ready,
        queryFn: ordersApi.load,
        retry: false,
        networkMode: 'always',
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const localOrders = useLocalCollection<LocalRecord<SalesOrder>>('orders');
    const localRefunds = useLocalCollection<LocalRecord<RefundRecord>>('refunds', { includeDeleted: false });
    useEffect(() => {
        if (!local.database || !query.data) return;
        void Promise.all([
            replaceLocalPayloads(local.database, 'orders', query.data.orders),
            replaceLocalPayloads(local.database, 'refunds', query.data.refunds),
        ]).then(
            () => setProjectionError(''),
            (reason) =>
                setProjectionError(
                    reason instanceof Error ? reason.message : 'Unable to update local orders.',
                ),
        );
    }, [local.database, query.data]);
    const refreshMutation = useMutation({
        mutationFn: async (signal?: AbortSignal) => {
            await ordersApi.sync(signal);
            await ordersApi.refresh(signal);
        },
        onSettled: () => client.invalidateQueries({ queryKey: key }),
    });
    const refundMutation = useMutation({
        mutationFn: ({
            order,
            selections,
            reason,
            method,
        }: {
            order: SalesOrder;
            selections: RefundSelection[];
            reason: string;
            method: string;
        }) => ordersApi.createRefund(order, selections, reason, method),
        onSuccess: () => client.invalidateQueries({ queryKey: key }),
    });
    return {
        orders: payloadsFromRecords(localOrders.records),
        refunds: payloadsFromRecords(localRefunds.records),
        loading: query.isFetching,
        refreshing: refreshMutation.isPending,
        refunding: refundMutation.isPending,
        error:
            local.error ||
            auth.error ||
            projectionError ||
            String(
                refreshMutation.error instanceof Error
                    ? refreshMutation.error.message
                    : query.error instanceof Error
                      ? query.error.message
                      : '',
            ),
        refresh: (signal?: AbortSignal) => refreshMutation.mutateAsync(signal),
        createRefund: refundMutation.mutateAsync,
    };
}
