import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { billingApi, type BillingCache } from '../billingApi';
import { useAuthSession } from '../../auth/AuthSessionContext';
import { useLocalDatabase } from '../../../db/DatabaseProvider';

export function useBillingData() {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const userId = auth.session?.user.id;
  const tenantId = auth.session?.tenant.id;
  const query = useQuery<{ key: string; cache: BillingCache }>({
    queryKey: ['billing-cache', userId, tenantId],
    enabled: ready,
    networkMode: 'always',
    queryFn: billingApi.load,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const syncMutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (signal?: AbortSignal) => {
      await billingApi.sync(signal);
      await billingApi.refresh(signal);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['billing-cache'] });
    },
  });
  const reload = async () => {
    await query.refetch();
  };
  const refresh = async (signal?: AbortSignal) => {
    if (!auth.initializing && !auth.session) {
      await auth.refreshSession();
      return;
    }
    if (!ready || running.current) return;
    running.current = true;
    try {
      await syncMutation.mutateAsync(signal);
    } catch {
      // TanStack Query retains the mutation error for the billing status UI.
    } finally {
      running.current = false;
    }
  };
  const error = syncMutation.error ?? query.error;
  return {
    data: ready ? query.data : undefined,
    error: local.error || auth.error || (error instanceof Error ? error.message : ''),
    busy: query.isFetching || syncMutation.isPending,
    refresh,
    reload,
  };
}
