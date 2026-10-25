import { createPrinterManagementApi } from '@indyzai/feature-printers/managementApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';
export const printerManagementApi = createPrinterManagementApi({
  request: requestPos,
  receiptContext: () => {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Sign in to preview this receipt.');
    return {
      businessName: session.organization?.name || session.tenant.name || 'IndyzAI',
      currencyCode: String(session.organization?.settings.currency || 'INR'),
      branches: session.organization?.branches,
      timeZone:
        typeof session.organization?.settings.timezone === 'string'
          ? session.organization.settings.timezone
          : undefined,
    };
  },
  getContext: () => {
    const session = getActiveAuthSession(),
      database = getActiveDatabase();
    if (!session || !database || database.scope.tenantId !== String(session.tenant.id))
      throw new Error('Local workspace is not ready.');
    return {
      database,
      scope: createScopeKey(database.scope),
      token: session.token,
      tenant: String(session.tenant.id),
    };
  },
});
