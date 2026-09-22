import * as Crypto from 'expo-crypto';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase, mapBootstrapCustomer } from '@indyzai/pos-database';
import { createCustomersApi } from '@indyzai/feature-customers';
import { requestPos } from '../../core/api/posApi';

export type { LocalCustomer } from '@indyzai/feature-customers';
export const customersApi = createCustomersApi({
    getContext(databaseOverride) {
        const session = getActiveAuthSession();
        const database = databaseOverride ?? getActiveDatabase();
        if (!session || !database) throw new Error('Your local workspace is still initializing.');
        return {
            database,
            scope: createScopeKey(database.scope),
            tenant: String(session.tenant.id),
            token: session.token,
        };
    },
    request: requestPos,
    createId: Crypto.randomUUID,
    mapCustomer: (value) => ({ ...mapBootstrapCustomer(value), type: 'CUSTOMER' }),
});
