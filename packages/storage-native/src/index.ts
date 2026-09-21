type SecureStoreModule = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const memoryFallback = new Map<string, string>();
const hasWebStorage = () => typeof globalThis.localStorage !== 'undefined';
const getSecureStore = async (): Promise<SecureStoreModule> => {
  // @ts-ignore
  return await import('expo-secure-store');
};

export const kvStore: KeyValueStorage = {
  async get(key: string): Promise<string | null> {
    if (hasWebStorage()) return globalThis.localStorage.getItem(key);
    try {
      const SecureStore = await getSecureStore();
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (hasWebStorage()) {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    try {
      const SecureStore = await getSecureStore();
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },
  async remove(key: string): Promise<void> {
    if (hasWebStorage()) {
      globalThis.localStorage.removeItem(key);
      return;
    }
    memoryFallback.delete(key);
    try {
      const SecureStore = await getSecureStore();
      await SecureStore.deleteItemAsync(key);
    } catch {
      // The fallback keeps Expo Go sessions usable when its native module is stale.
    }
  },
};
import type { KeyValueStorage } from '@indyzai/pos-storage';
