import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LocalDatabaseProvider,
  useLocalDatabase,
  useRequiredLocalDatabase,
  type DatabaseState,
} from '@indyzai/pos-database/react';
import { createLogger } from '@indyzai/pos-core';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { createStoreLocalDatabase } from '@indyzai/pos-database/store';
import {
  normalizePosRole,
  setActiveDatabase,
  type DatabaseScope,
  type LocalDatabase,
} from '@indyzai/pos-database';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { kvStore } from '@indyzai/pos-core/storage';
import { queryClient } from '@indyzai/pos-core/query';
import { billingApi } from '../features/billing/billingApi';

const logger = createLogger('Database:store');

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { session, initializing: authInitializing } = useAuthSession();
  const [state, setState] = useState<Omit<DatabaseState, 'retry'>>({
    status: session ? 'initializing' : 'ready',
    error: '',
    database: null,
    scope: null,
  });
  const generation = useRef(0);

  const initialize = useCallback(async () => {
    const current = ++generation.current;
    if (authInitializing) return;
    if (!session) {
      setActiveDatabase(null);
      setState({ status: 'ready', error: '', database: null, scope: null });
      return;
    }
    setState((previous) => ({ ...previous, status: 'initializing', error: '' }));
    try {
      const registration = await authApi.getDeviceRegistrationDetails();
      const activeCounter = session.organization?.activeSession;
      const scope: DatabaseScope = {
        appProfile: 'store',
        tenantId: String(session.tenant.id),
        userId: String(session.user.id),
        role: normalizePosRole(session.tenant.role || session.user.role),
        storeIds: session.organization?.branches.map((branch) => branch.id) ?? [],
        deviceId: registration.deviceId ?? registration.deviceIdentifier ?? 'development-device',
        counterId: activeCounter?.counterId,
      };
      logger.info('Initializing store database', {
        tenantId: scope.tenantId,
        role: scope.role,
        deviceId: scope.deviceId,
      });
      const database = await createStoreLocalDatabase(scope);
      // A tenant switch is the same isolation boundary as a user switch. Keeping
      // only the user id here allowed one user's previous business data and
      // React Query projections to remain visible after changing workspaces.
      const owner = `${scope.tenantId}:${scope.userId}`;
      const previousOwner = await kvStore.get(appStorageKeys.pos.databaseOwner);
      if (previousOwner && previousOwner !== owner) {
        logger.warn('Database owner changed, clearing local database', {
          previousOwner,
          currentOwner: owner,
        });
        await database.clear();
        queryClient.clear();
      }
      await kvStore.set(appStorageKeys.pos.databaseOwner, owner);
      if (current !== generation.current) {
        await database.close();
        return;
      }
      logger.info('Store database ready', { tenantId: scope.tenantId, role: scope.role });
      setState((previous) => {
        if (previous.database && previous.database !== database) {
          void previous.database.close();
        }
        return { status: 'ready', error: '', database, scope };
      });
      // Network is an optional synchronization source. The bootstrap writes to
      // the local database; screens continue observing local collections only.
      // Failure is intentionally non-fatal so a previously bootstrapped user can
      // open the app without connectivity.
      void billingApi.refresh(undefined, database, true).catch((reason) => {
        logger.warn('Initial database pull deferred until connectivity returns', {
          error: reason instanceof Error ? reason.message : String(reason),
        });
      });
    } catch (reason) {
      if (current !== generation.current) return;
      const errorMessage = reason instanceof Error ? reason.message : 'Local storage unavailable';
      logger.error('Store database initialization failed', { error: errorMessage });
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: errorMessage,
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
  return <LocalDatabaseProvider value={value}>{children}</LocalDatabaseProvider>;
}
export { useLocalDatabase, useRequiredLocalDatabase };
