import { createInventoryApi } from '@indyzai/feature-inventory/inventoryApi';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { requestPos } from '../../core/api/posApi';
import { billingApi } from '../billing/billingApi';

export const inventoryApi = createInventoryApi({
  request: requestPos,
  scopeKey: appStorageKeys.pos.billing,
  billing: billingApi,
});
