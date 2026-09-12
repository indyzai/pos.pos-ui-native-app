import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../../db/client';
import { initializeDatabase } from '../../db/migrations';
import { restaurantTables } from '../../db/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '../../db/webClient';
import type { RestaurantTable } from './types';
export async function readRestaurantTables(scope: string) {
    if (!hasNativeDatabase) {
        const rows = await readWebScopedRecords<RestaurantTable & { scope: string; storageId: string }>(
            webStores.restaurantTables,
            scope,
        );
        return rows.map(({ scope: _s, storageId: _i, ...row }) => row);
    }
    initializeDatabase();
    return getDatabase()
        .select()
        .from(restaurantTables)
        .where(eq(restaurantTables.scope, scope))
        .all()
        .flatMap((row) => {
            try {
                return [JSON.parse(row.payload) as RestaurantTable];
            } catch {
                return [];
            }
        });
}
export async function replaceRestaurantTables(scope: string, records: RestaurantTable[]) {
    if (!hasNativeDatabase) return replaceWebScopedRecords(webStores.restaurantTables, scope, records);
    initializeDatabase();
    getDatabase().transaction((tx) => {
        tx.delete(restaurantTables).where(eq(restaurantTables.scope, scope)).run();
        for (const row of records)
            tx.insert(restaurantTables)
                .values({
                    id: `${scope}:table:${row.id}`,
                    scope,
                    remoteId: row.id,
                    payload: JSON.stringify(row),
                })
                .run();
    });
}
