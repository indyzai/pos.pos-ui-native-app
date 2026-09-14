import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createRuntimeEnvironmentManager, type ApiEnvironment } from '@indyzai/pos-backend/runtime-env';
import { Platform } from 'react-native';

export type { ApiEnvironment };

const manager = createRuntimeEnvironmentManager({
  storageKey: appStorageKeys.pos.apiEnvironment,
  // A localhost API is not reachable from a physical iOS or Android device.
  // Native builds therefore always use the production endpoints. Web keeps the
  // development environment switch for local browser development.
  development: Platform.OS === 'web' ? undefined : false,
});

export const canSwitchApiEnvironment = Platform.OS === 'web';

export const getApiEnvironment = manager.getApiEnvironment;
export const setApiEnvironment = manager.setApiEnvironment;
export const getRuntimeApiUrls = manager.getRuntimeApiUrls;
