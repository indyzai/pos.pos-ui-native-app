import { getActiveDatabase } from '@indyzai/pos-database';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createNativeMutationReplay } from '@indyzai/pos-sync-native';
import { createPosApiClient } from '@indyzai/pos-api/pos-api';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';

const client = createPosApiClient({ getRuntimeApiUrls, loggerScope: 'POS API' });
export const requestPos = client.requestPos;
export const requestPosBootstrap = client.requestPosBootstrap;
export const requestPosHasUpdates = client.requestPosHasUpdates;
export const syncApiMutations = createNativeMutationReplay({
  getDatabase: getActiveDatabase,
  getSession: getActiveAuthSession,
  request: requestPos,
});
