import { expect, mock, test } from 'bun:test';

globalThis.__DEV__ = true;
mock.module('react-native', () => ({ Platform: { OS: 'web' } }));
mock.module('expo-auth-session', () => ({}));
mock.module('expo-application', () => ({}));
mock.module('expo-constants', () => ({ default: {}, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
mock.module('expo-web-browser', () => ({ maybeCompleteAuthSession() {} }));
const nativeCall = mock(() => {
  throw new Error('Native method called on web');
});
mock.module('expo-secure-store', () => ({
  getItemAsync: nativeCall,
  setItemAsync: nativeCall,
  deleteItemAsync: nativeCall,
}));
mock.module('expo-local-authentication', () => ({ authenticateAsync: nativeCall }));
const { authApi } = await import('../../../src/features/auth/authApi');

test('tenant resolution uses the hydrated profile even when the stored user is stale', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
    },
  });
  try {
    const profile = {
      id: 'user-1',
      email: 'user@example.test',
      tenants: [{ id: 'business-1', name: 'Demo', role: 'owner' }],
    };
    expect(await authApi.getSelectedTenant(profile)).toEqual(profile.tenants[0]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('web never invokes native device authentication or SecureStore', async () => {
  expect(await authApi.hasRegisteredDevice()).toBe(false);
  await expect(authApi.authenticateWithDevice()).rejects.toThrow('disabled on web');
  await expect(authApi.registerDevice('123456')).rejects.toThrow('disabled on web');
  await expect(authApi.changeDevicePin('123456')).rejects.toThrow('disabled on web');
  expect(nativeCall).not.toHaveBeenCalled();
});
