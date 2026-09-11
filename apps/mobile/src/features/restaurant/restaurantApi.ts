import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { readRestaurantTables, replaceRestaurantTables } from './restaurantTableRepository';
import type { RestaurantTable } from './types';
const context = () => {
  const session = getActiveAuthSession();
  if (!session) throw new Error('Workspace is not ready.');
  return session;
};
const scope = () => {
  const session = context();
  return `indyz.billing.v1:${session.user.id}:${session.tenant.id}`;
};
export const restaurantApi = {
  load: () => readRestaurantTables(scope()),
  async refresh(branchId?: string) {
    const session = context();
    try {
      const data = await requestPos<{ restaurantTables: RestaurantTable[] }>(
        session.token,
        String(session.tenant.id),
        `query BillingRestaurantTables($branchId: ID) { restaurantTables(branchId: $branchId) { id branchId name capacity status } }`,
        { branchId },
      );
      await replaceRestaurantTables(scope(), data.restaurantTables ?? []);
    } catch (error) {
      if (!(await readRestaurantTables(scope())).length) throw error;
    }
    return readRestaurantTables(scope());
  },
};
