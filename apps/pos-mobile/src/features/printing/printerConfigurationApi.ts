import { requestPos } from '../../core/api/posApi';
import { createPrinterConfigurationApi } from '@indyzai/feature-printers/configuration';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';

export const printerConfigurationApi = createPrinterConfigurationApi(requestPos, 'pos', () => {
    const session = getActiveAuthSession(),
        database = getActiveDatabase();
    if (!session || !database) throw new Error('Local workspace is not ready.');
    return { session, database, scope: createScopeKey(database.scope) };
});
