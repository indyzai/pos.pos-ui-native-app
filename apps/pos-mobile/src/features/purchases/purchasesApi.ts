import { createPurchasesApi } from '@indyzai/feature-purchase/purchasesApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';

export const purchasesApi = createPurchasesApi({
    getContext() {
        const session = getActiveAuthSession();
        const database = getActiveDatabase();
        if (!session || !database) throw new Error('Your local workspace is still initializing.');
        return {
            database,
            scope: createScopeKey(database.scope),
            tenant: String(session.tenant.id),
            token: session.token,
        };
    },
    request: requestPos,
});
