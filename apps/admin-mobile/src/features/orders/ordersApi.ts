import * as Crypto from 'expo-crypto';
import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createOrdersApi } from '@indyzai/feature-orders/ordersApi';
import { ordersRepository } from './ordersRepository';

export const ordersApi = createOrdersApi({
    repository: ordersRepository,
    request: requestPos,
    createId: () => Crypto.randomUUID(),
    getContext: () => {
        const session = getActiveAuthSession();
        if (!session) throw new Error('Your workspace is still initializing.');
        return {
            scope: appStorageKeys.admin.orders(session.user.id, session.tenant.id),
            tenant: String(session.tenant.id),
            token: session.token,
        };
    },
});
