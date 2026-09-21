import { createPosApiClient } from '@indyzai/pos-api/pos-api';
import { getRuntimeApiUrls } from '../../config/runtimeEnvironment';

const client = createPosApiClient({
    getRuntimeApiUrls,
    loggerScope: 'POS API',
});

export const requestPos = client.requestPos;
export const requestPosBootstrap = client.requestPosBootstrap;
export const requestPosHasUpdates = client.requestPosHasUpdates;
