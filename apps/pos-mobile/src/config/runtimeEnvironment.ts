import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createRuntimeEnvironmentManager, type ApiEnvironment } from '@indyzai/pos-api/runtime-env';
export type { ApiEnvironment };

// A localhost API is not reachable from a physical iOS or Android device.
// Native builds therefore always use the production endpoints. Web keeps the
// development environment switch for local browser development.
const isWeb =
  typeof window !== 'undefined' &&
  typeof (window as any).document !== 'undefined' &&
  (typeof navigator === 'undefined' || (navigator as any).product !== 'ReactNative');

const manager = createRuntimeEnvironmentManager({
  storageKey: appStorageKeys.pos.apiEnvironment,
  development: isWeb ? undefined : false,
});

export const canSwitchApiEnvironment = isWeb;

export const getApiEnvironment = manager.getApiEnvironment;
export const setApiEnvironment = manager.setApiEnvironment;
export const getRuntimeApiUrls = manager.getRuntimeApiUrls;
