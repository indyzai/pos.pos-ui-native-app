import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../features/auth/authApi';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { createLocalDatabase } from './localDatabase';
import { normalizePosRole, type DatabaseScope, type LocalDatabase } from './types';

type DatabaseState = {
  status: 'initializing' | 'ready' | 'error';
  error: string;
  database: LocalDatabase | null;
  scope: DatabaseScope | null;
  retry: () => Promise<void>;
};

const Context = createContext<DatabaseState | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { session, initializing: authInitializing } = useAuthSession();
  const [state, setState] = useState<Omit<DatabaseState, 'retry'>>({
    status: 'initializing',
    error: '',
    database: null,
    scope: null,
  });
  const generation = useRef(0);

  const initialize = useCallback(async () => {
    const current = ++generation.current;
    if (authInitializing) return;
    if (!session) {
      setState({ status: 'ready', error: '', database: null, scope: null });
      return;
    }
    setState((previous) => ({ ...previous, status: 'initializing', error: '' }));
    try {
      const registration = await authApi.getDeviceRegistrationDetails();
      const activeCounter = session.organization?.activeSession;
      const scope: DatabaseScope = {
        tenantId: String(session.tenant.id),
        userId: String(session.user.id),
        role: normalizePosRole(session.tenant.role || session.user.role),
        storeIds: session.organization?.branches.map((branch) => branch.id) ?? [],
        deviceId: registration.deviceId ?? registration.deviceIdentifier ?? 'development-device',
        counterId: activeCounter?.counterId,
      };
      const database = await createLocalDatabase(scope);
      if (current !== generation.current) {
        await database.close();
        return;
      }
      setState((previous) => {
        void previous.database?.close();
        return { status: 'ready', error: '', database, scope };
      });
    } catch (reason) {
      if (current !== generation.current) return;
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: reason instanceof Error ? reason.message : 'Local storage unavailable',
      }));
    }
  }, [authInitializing, session]);

  useEffect(() => {
    void initialize();
    return () => {
      generation.current++;
    };
  }, [initialize]);

  const value = useMemo<DatabaseState>(() => ({ ...state, retry: initialize }), [initialize, state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLocalDatabase() {
  const state = useContext(Context);
  if (!state) throw new Error('DatabaseProvider is required');
  return state;
}

export function useRequiredLocalDatabase(): LocalDatabase {
  const state = useLocalDatabase();
  if (state.status !== 'ready' || !state.database) throw new Error('The local database is not ready.');
  return state.database;
}
