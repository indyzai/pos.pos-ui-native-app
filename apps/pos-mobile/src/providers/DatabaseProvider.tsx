import { usePathname } from 'expo-router';
import { uiPageKey } from '@indyzai/pos-sync';
import { acknowledgeCheckout } from '@indyzai/feature-billing/checkout';
import { metadataApi } from '../features/catalog/metadataApi';
import { printerConfigurationApi } from '../features/printing/printerConfigurationApi';
import { purchasesApi } from '../features/purchases/purchasesApi';
import { customersApi } from '../features/customers/customersApi';
import { NativeSyncWorker, NativeRefreshWorker } from '@indyzai/pos-sync-native/react';
import {
  CanonicalJobDatabase,
  createNativeDomainHandlers,
  stopNativeSyncAndWait,
  stopBillingOutboxWorkerAndWait,
} from '@indyzai/pos-sync-native';
import { queueWaybillAfterSale } from '@indyzai/feature-orders/logistics/waybillSync';
import { counterSessionApi } from '../features/counter-session/counterSessionApi';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LocalDatabaseProvider,
  useLocalDatabase,
  useRequiredLocalDatabase,
  type DatabaseState,
} from '@indyzai/pos-database/react';
import { createLogger } from '@indyzai/pos-utils';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { createStoreLocalDatabase } from '@indyzai/pos-database/store';
import { normalizePosRole, setActiveDatabase, type DatabaseScope } from '@indyzai/pos-database';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { kvStore } from '@indyzai/pos-storage-native';
import { queryClient } from '@indyzai/pos-state';
import { billingApi } from '../features/billing/billingApi';
import { settingsApi } from '../features/settings/settingsApi';
import { SettingsBridge } from '@indyzai/feature-organization/settings';
import { projectOrganization } from '@indyzai/feature-organization/projectOrganization';

import { createAuthenticatedPosApiFactory } from '@indyzai/pos-apis';
import { requestPos, requestPosSync } from '../core/api/posApi';
import { settingsFields } from '@indyzai/feature-organization/settingsSchema';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';

const domainHandlers = createNativeDomainHandlers({
  customers: customersApi,
  purchases: purchasesApi,
  settings: settingsApi,
  printers: printerConfigurationApi,
  metadata: metadataApi,
});

const logger = createLogger('Database:store');

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, initializing: authInitializing } = useAuthSession();
  const [state, setState] = useState<Omit<DatabaseState, 'retry'>>({
    status: session ? 'initializing' : 'ready',
    error: '',
    database: null,
    scope: null,
  });
  const generation = useRef(0);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const workspaceKey = session
    ? `${session.user.id}:${session.tenant.id}:${session.tenant.role}:${
        session.organization?.branches
          .map((branch) => branch.id)
          .sort()
          .join(',') ?? ''
      }:${session.organization?.activeSession?.counterId ?? ''}`
    : '';
  const initialize = useCallback(async () => {
    const session = sessionRef.current;
    const current = ++generation.current;
    if (authInitializing) return;
    if (!session) {
      setActiveDatabase(null);
      setState({ status: 'ready', error: '', database: null, scope: null });
      return;
    }
    setState((previous) => ({ ...previous, status: 'initializing', error: '' }));
    try {
      await stopNativeSyncAndWait();
      await stopBillingOutboxWorkerAndWait();
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
      const rawDatabase = await createStoreLocalDatabase(scope, { activate: false });
      const database = new CanonicalJobDatabase(rawDatabase);
      await database.migrate([appStorageKeys.pos.billing(session.user.id, session.tenant.id)]);
      // A tenant switch is the same isolation boundary as a user switch. Keeping
      // only the user id here allowed one user's previous business data and
      // React Query projections to remain visible after changing workspaces.
      const owner = `${scope.tenantId}:${scope.userId}`;
      const previousOwner = await kvStore.get(appStorageKeys.pos.databaseOwner);
      if (previousOwner && previousOwner !== owner) {
        logger.warn('Database owner changed; preserving scoped local records', {
          previousOwner,
          currentOwner: owner,
        });
        // Scoped repositories isolate owners. Preserve unsent jobs for the original owner.
        queryClient.clear();
      }
      await kvStore.set(appStorageKeys.pos.databaseOwner, owner);
      if (session.organization) await projectOrganization(database, session.organization);
      if (current !== generation.current) {
        await database.close();
        return;
      }
      setActiveDatabase(database);
      logger.info('Store database ready', { tenantId: scope.tenantId, role: scope.role });
      setState((previous) => {
        if (previous.database && previous.database !== database) {
          void previous.database.close();
        }
        return { status: 'ready', error: '', database, scope };
      });
      // The incoming worker refreshes server revisions after the local workspace
      // is ready; screens remain available from their saved data while offline.
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
  }, [authInitializing, workspaceKey]);

  useEffect(() => {
    void initialize();
    return () => {
      generation.current++;
    };
  }, [initialize]);

  useEffect(() => {
    if (!state.database || state.status !== 'ready' || !session?.organization) return;
    if (String(session.tenant.id) !== state.database.scope.tenantId) return;
    void projectOrganization(state.database, session.organization).catch((reason) =>
      logger.error('Could not update local organization', { error: String(reason) }),
    );
  }, [state.database, state.status, session?.organization, session?.tenant.id]);

  const entityApiFactory = useMemo(
    () =>
      createAuthenticatedPosApiFactory({
        request: requestPos,
        getSession: () => sessionRef.current,
        getScope: () => state.database?.scope,
      }),
    [state.database],
  );
  const value = useMemo<DatabaseState>(
    () => ({ ...state, retry: initialize, entityApiFactory }),
    [initialize, state, entityApiFactory],
  );
  return (
    <LocalDatabaseProvider value={value}>
      {state.database && state.status === 'ready' && session ? (
        <>
          <NativeRefreshWorker
            pageKey={uiPageKey(pathname)}
            database={state.database}
            authApi={authApi}
            getSession={getActiveAuthSession}
            requestSync={requestPosSync}
            settingsKeys={settingsFields.map((field) => field.key)}
            onError={(error) => logger.warn('Incoming refresh deferred', { error: String(error) })}
          />
          <NativeSyncWorker
            database={state.database as CanonicalJobDatabase}
            authApi={authApi}
            getSession={getActiveAuthSession}
            request={requestPos}
            tableHandlers={domainHandlers}
            afterSaleAcknowledged={async (database, sale, bill, jobId) => {
              await acknowledgeCheckout(database, sale);
              await queueWaybillAfterSale(database, sale, bill, jobId);
            }}
            onError={(error) => logger.warn('Synchronization deferred', { error: String(error) })}
          />
          <SettingsBridge surface="pos" />
        </>
      ) : null}
      {children}
    </LocalDatabaseProvider>
  );
}

export { useLocalDatabase, useRequiredLocalDatabase };
