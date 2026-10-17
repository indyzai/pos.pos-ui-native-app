import * as Crypto from 'expo-crypto';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';
import { createMetadataApi } from '@indyzai/feature-catalog/metadataApi';
import { requestPos } from '../../core/api/posApi';
export const metadataApi = createMetadataApi({
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
});
