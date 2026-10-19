import { Platform } from 'react-native';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createRuntimeEnvironmentManager, type ApiEnvironment } from '@indyzai/pos-api/runtime-env';

export type { ApiEnvironment };

const manager = createRuntimeEnvironmentManager({
  storageKey: appStorageKeys.admin.apiEnvironment,
  development: Platform.OS === 'web' ? undefined : false,
});

export const getApiEnvironment = manager.getApiEnvironment;
export const setApiEnvironment = manager.setApiEnvironment;
export const getRuntimeApiUrls = manager.getRuntimeApiUrls;
