import { useEffect, useMemo } from 'react';
import { replaceLocalPayloads, useLocalCollection, useLocalDatabase } from '@indyzai/pos-database';
import type { LocalRecord } from '@indyzai/pos-database';
import { restaurantApi } from './restaurantApi';
import type { RestaurantTable } from './types';

export function useRestaurantTables(enabled: boolean, branchId?: string) {
  const local = useLocalDatabase();
  const records = useLocalCollection<LocalRecord<RestaurantTable>>('restaurant_tables');

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
        ? records.records
            .map((record) => record.payload)
            .filter((table) => !branchId || table.branchId === branchId)
        : [],
    [branchId, enabled, records.records],
  );
}
