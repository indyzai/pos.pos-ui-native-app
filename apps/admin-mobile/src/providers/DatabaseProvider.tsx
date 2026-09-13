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
import { createAdminLocalDatabase } from '@indyzai/pos-database/admin';
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

const logger = createLogger('Database:admin');

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
            const accountRole = String(session.user.role ?? '').toLowerCase();
            const tenantRole = String(session.tenant.role ?? '').toLowerCase();
            const databaseRole = normalizePosRole(
                accountRole === 'superadmin' ? 'superadmin' : tenantRole === 'owner' ? 'owner' : 'admin',
            );
            const scope: DatabaseScope = {
                appProfile: 'admin',
                tenantId: String(session.tenant.id),
                userId: String(session.user.id),
                role: databaseRole,
                storeIds: session.organization?.branches.map((branch) => branch.id) ?? [],
                deviceId: registration.deviceId ?? registration.deviceIdentifier ?? 'development-device',
                counterId: activeCounter?.counterId,
            };
            logger.info('Initializing admin database', {
                tenantId: scope.tenantId,
                role: scope.role,
                deviceId: scope.deviceId,
            });
            const database = await createAdminLocalDatabase(scope);
            // Tenant and user together own the local projection. This prevents
            // query and database rows from leaking across workspace switches.
            const owner = `${scope.tenantId}:${scope.userId}`;
            const previousOwner = await kvStore.get(appStorageKeys.admin.databaseOwner);
            if (previousOwner && previousOwner !== owner) {
                logger.warn('Database owner changed, clearing local database', {
                    previousOwner,
                    currentOwner: owner,
                });
                await database.clear();
                queryClient.clear();
            }
            await kvStore.set(appStorageKeys.admin.databaseOwner, owner);
            if (current !== generation.current) {
                await database.close();
                return;
            }
            logger.info('Admin database ready', { tenantId: scope.tenantId, role: scope.role });
            setState((previous) => {
                if (previous.database && previous.database !== database) {
                    void previous.database.close();
                }
                return { status: 'ready', error: '', database, scope };
            });
            // The API only refreshes the durable local projection. UI consumers
            // remain bound to local collections, and an offline failure does not
            // prevent the cached workspace from opening.
            void billingApi.refresh(undefined, database, true).catch((reason) => {
                logger.warn('Initial database pull deferred until connectivity returns', {
                    error: reason instanceof Error ? reason.message : String(reason),
                });
            });
        } catch (reason) {
            if (current !== generation.current) return;
            const errorMessage = reason instanceof Error ? reason.message : 'Local storage unavailable';
            logger.error('Admin database initialization failed', { error: errorMessage });
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
