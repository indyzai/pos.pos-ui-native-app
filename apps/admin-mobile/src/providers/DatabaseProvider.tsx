import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    LocalDatabaseProvider,
    useLocalDatabase,
    useRequiredLocalDatabase,
    type DatabaseState,
} from '@indyzai/pos-database/react';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { createAdminLocalDatabase } from '@indyzai/pos-database/admin';
import { normalizePosRole, type DatabaseScope, type LocalDatabase } from '@indyzai/pos-database';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { kvStore } from '../storage/kvStore';

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
            const database = await createAdminLocalDatabase(scope);
            const owner = String(session.user.id);
            const previousOwner = await kvStore.get(appStorageKeys.admin.databaseOwner);
            if (previousOwner && previousOwner !== owner) await database.clear();
            await kvStore.set(appStorageKeys.admin.databaseOwner, owner);
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
    return <LocalDatabaseProvider value={value}>{children}</LocalDatabaseProvider>;
}
export { useLocalDatabase, useRequiredLocalDatabase };
