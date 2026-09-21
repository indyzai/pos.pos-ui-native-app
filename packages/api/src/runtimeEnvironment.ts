import { kvStore as defaultKvStore } from '@indyzai/pos-storage-native';
import { development as defaultDev, env as defaultEnv, productionApiUrls as defaultProdUrls } from '@indyzai/pos-config';

export type ApiEnvironment = 'local' | 'production';

export interface RuntimeEnvironmentOptions {
  storageKey: string;
  kvStore?: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };
  development?: boolean;
  productionApiUrls?: { pos: string; posBase: string; auth: string };
  env?: { posApiUrl: string; posBaseUrl: string; authApiUrl: string };
}

export function createRuntimeEnvironmentManager(options: RuntimeEnvironmentOptions) {
  const kv = options.kvStore ?? defaultKvStore;
  const dev = options.development ?? defaultDev;
  const prodUrls = options.productionApiUrls ?? defaultProdUrls;
  const envUrls = options.env ?? defaultEnv;
  const storageKey = options.storageKey;

  let cachedEnvironment: ApiEnvironment | undefined;
  let loading: Promise<ApiEnvironment> | undefined;

  async function getApiEnvironment(): Promise<ApiEnvironment> {
    if (!dev) return 'production';
    if (cachedEnvironment) return cachedEnvironment;
    return (loading ??= kv
      .get(storageKey)
      .then((value: string | null) => {
        cachedEnvironment = value === 'production' ? 'production' : 'local';
        return cachedEnvironment;
      })
      .finally(() => {
        loading = undefined;
      }));
  }

  async function setApiEnvironment(value: ApiEnvironment): Promise<void> {
    if (!dev) return;
    await kv.set(storageKey, value);
    cachedEnvironment = value;
  }

  async function getRuntimeApiUrls() {
    const environment = await getApiEnvironment();
    return environment === 'production'
      ? {
          environment,
          posApiUrl: prodUrls.pos,
          posBaseUrl: prodUrls.posBase,
          authApiUrl: prodUrls.auth,
        }
      : {
          environment,
          posApiUrl: envUrls.posApiUrl,
          posBaseUrl: envUrls.posBaseUrl,
          authApiUrl: envUrls.authApiUrl,
        };
  }

  return {
    getApiEnvironment,
    setApiEnvironment,
    getRuntimeApiUrls,
  };
}
