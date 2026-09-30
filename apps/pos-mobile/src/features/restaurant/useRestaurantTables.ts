import { useEffect, useMemo } from 'react';
import { replaceLocalPayloads, useLocalDatabase } from '@indyzai/pos-database';
import { restaurantApi } from './restaurantApi';
import type { RestaurantTable } from '@indyzai/feature-restaurant/types';
import { OfflineTableName, useAppOfflineEntity } from '../../hooks/useAppOfflineEntity';

export function useRestaurantTables(enabled: boolean, branchId?: string) {
  const local = useLocalDatabase();
  const records = useAppOfflineEntity<RestaurantTable>({
    tableName: OfflineTableName.RestaurantTables,
    listSelector: (record) => record.payload,
    pageSize: 100,
  });

  useEffect(() => {
    if (!enabled || !local.database) return;
    let active = true;
    const project = async (tables: RestaurantTable[]) => {
      if (active && local.database) await replaceLocalPayloads(local.database, 'restaurant_tables', tables);
    };
    void restaurantApi.load().then(project);
    void restaurantApi
      .refresh(branchId)
      .then(project)
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [branchId, enabled, local.database]);

  useEffect(() => {
    if (!records.loading && !records.loadingMore && records.localHasMore) void records.loadMore();
  }, [records.loading, records.loadingMore, records.localHasMore, records.loadMore]);

  return useMemo(
    () => (enabled ? records.items.filter((table) => !branchId || table.branchId === branchId) : []),
    [branchId, enabled, records.items],
  );
}
