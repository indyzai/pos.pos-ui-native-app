import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

type DatabaseState = {
  status: 'initializing' | 'ready' | 'error';
  error: string;
  retry: () => Promise<void>;
};
const Context = createContext<DatabaseState | null>(null);
let initialization: Promise<void> | undefined;
export function initializeLocalDatabase() {
  return (initialization ??= (async () => {
    if (Platform.OS === 'web') {
      await (await import('./webClient')).openDatabase();
    } else {
      (await import('./migrations')).initializeDatabase();
    }
  })().catch((error) => {
    initialization = undefined;
    throw error;
  }));
}
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DatabaseState['status']>('initializing');
  const [error, setError] = useState('');
  const retry = useCallback(async () => {
    setStatus('initializing');
    try {
      await initializeLocalDatabase();
      setError('');
      setStatus('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Local storage unavailable');
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    void retry();
  }, [retry]);
  return <Context.Provider value={{ status, error, retry }}>{children}</Context.Provider>;
}
export function useLocalDatabase() {
  const state = useContext(Context);
  if (!state) throw new Error('DatabaseProvider is required');
  return state;
}
