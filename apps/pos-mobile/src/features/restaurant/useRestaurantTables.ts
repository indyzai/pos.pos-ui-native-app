import { useEffect, useMemo } from 'react';
import { createLocalFirstTableHook, replaceLocalPayloads, useLocalDatabase } from '@indyzai/pos-database';
import { restaurantApi } from './restaurantApi';
import type { RestaurantTable } from './types';

const useRestaurantTable = createLocalFirstTableHook<RestaurantTable>({
  table: 'restaurant_tables',
  entityType: 'RESTAURANT_TABLE',
});

export function useRestaurantTables(enabled: boolean, branchId?: string) {
  const local = useLocalDatabase();
  const records = useRestaurantTable();

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

  return useMemo(
    () =>
      enabled
        ? records.data
            .map((record) => record.payload)
            .filter((table) => !branchId || table.branchId === branchId)
        : [],
    [branchId, enabled, records.data],
  );
}
