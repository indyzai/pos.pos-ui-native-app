import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createRuntimeEnvironmentManager, type ApiEnvironment } from '@indyzai/pos-backend/runtime-env';

export type { ApiEnvironment };

const manager = createRuntimeEnvironmentManager({
  storageKey: appStorageKeys.pos.apiEnvironment,
});

export const getApiEnvironment = manager.getApiEnvironment;
export const setApiEnvironment = manager.setApiEnvironment;
export const getRuntimeApiUrls = manager.getRuntimeApiUrls;
