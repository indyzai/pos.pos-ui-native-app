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
  const refresh = useMutation({
    mutationFn: inventoryApi.refresh,
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-cache'] }),
  });
  const reconcile = useMutation({
    mutationFn: (input: StockReconciliationInput) => inventoryApi.reconcile(input),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-cache'] }),
  });
  const create = useMutation({
    mutationFn: (input: CreateInventoryItemInput) => inventoryApi.create(input),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-cache'] }),
  });
  const error = refresh.error ?? reconcile.error ?? create.error ?? query.error;
  return useMemo(
    () => ({
      products: query.data?.cache.products ?? [],
      updated: query.data?.cache.updated,
      loading: query.isLoading,
      refreshing: refresh.isPending,
      reconciling: reconcile.isPending,
      creating: create.isPending,
      error: local.error || auth.error || (error instanceof Error ? error.message : ''),
      refresh: () => refresh.mutateAsync(),
      reconcile: (input: StockReconciliationInput) => reconcile.mutateAsync(input),
      create: (input: CreateInventoryItemInput) => create.mutateAsync(input),
    }),
    [auth.error, create, error, local.error, query.data, query.isLoading, reconcile, refresh],
  );
}
