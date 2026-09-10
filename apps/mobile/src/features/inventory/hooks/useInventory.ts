import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useLocalDatabase } from '../../../db/DatabaseProvider';
import { useAuthSession } from '../../auth/AuthSessionContext';
import { inventoryApi } from '../inventoryApi';
import type { CreateInventoryItemInput, StockReconciliationInput } from '../types';

export function useInventory() {
  const auth = useAuthSession();
  const local = useLocalDatabase();
  const queryClient = useQueryClient();
  const ready = !auth.initializing && !!auth.session && local.status === 'ready';
  const queryKey = ['billing-cache', auth.session?.user.id, auth.session?.tenant.id];
  const query = useQuery({
    queryKey,
    queryFn: inventoryApi.load,
    enabled: ready,
    networkMode: 'always',
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const jobs = useQuery({
    queryKey: ['inventory-sync-jobs', auth.session?.user.id, auth.session?.tenant.id],
    queryFn: inventoryApi.listJobs,
    enabled: ready,
    networkMode: 'always',
    refetchInterval: (result) =>
      result.state.data?.some((job) => job.status === 'PENDING' || job.status === 'RUNNING') ? 1000 : false,
  });
  const refresh = useMutation({
    mutationFn: (signal?: AbortSignal) => inventoryApi.refresh(signal),
    retry: false,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-cache'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-sync-jobs'] });
    },
  });
  const reconcile = useMutation({
    mutationFn: (input: StockReconciliationInput) => inventoryApi.reconcile(input),
    retry: false,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-cache'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-sync-jobs'] });
    },
  });
  const create = useMutation({
    mutationFn: (input: CreateInventoryItemInput) => inventoryApi.create(input),
    retry: false,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-cache'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-sync-jobs'] });
    },
  });
  const error = refresh.error ?? reconcile.error ?? create.error ?? query.error;
  return useMemo(
    () => ({
      products: query.data?.cache.products ?? [],
      jobs: jobs.data ?? [],
      updated: query.data?.cache.updated,
      loading: query.isLoading,
      refreshing: refresh.isPending,
      reconciling: reconcile.isPending,
      creating: create.isPending,
      error: local.error || auth.error || (error instanceof Error ? error.message : ''),
      refresh: (signal?: AbortSignal) => refresh.mutateAsync(signal),
      reconcile: (input: StockReconciliationInput) => reconcile.mutateAsync(input),
      create: (input: CreateInventoryItemInput) => create.mutateAsync(input),
    }),
    [auth.error, create, error, jobs.data, local.error, query.data, query.isLoading, reconcile, refresh],
  );
}
