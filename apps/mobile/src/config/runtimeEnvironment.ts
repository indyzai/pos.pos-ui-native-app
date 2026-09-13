import { development, env, productionApiUrls } from './env';
import { kvStore } from '../storage/kvStore';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';

export type ApiEnvironment = 'local' | 'production';
const storageKey = appStorageKeys.pos.apiEnvironment;
let cachedEnvironment: ApiEnvironment | undefined;
let loading: Promise<ApiEnvironment> | undefined;

export async function getApiEnvironment(): Promise<ApiEnvironment> {
  if (!development) return 'production';
  if (cachedEnvironment) return cachedEnvironment;
  return (loading ??= kvStore
    .get(storageKey)
    .then((value) => {
      cachedEnvironment = value === 'production' ? 'production' : 'local';
      return cachedEnvironment;
    })
    .finally(() => {
      loading = undefined;
    }));
}

export async function setApiEnvironment(value: ApiEnvironment): Promise<void> {
  if (!development) return;
  await kvStore.set(storageKey, value);
  cachedEnvironment = value;
}

export async function getRuntimeApiUrls() {
  const environment = await getApiEnvironment();
  return environment === 'production'
    ? {
        environment,
        posApiUrl: productionApiUrls.pos,
        posBaseUrl: productionApiUrls.posBase,
        authApiUrl: productionApiUrls.auth,
      }
    : { environment, posApiUrl: env.posApiUrl, posBaseUrl: env.posBaseUrl, authApiUrl: env.authApiUrl };
}
