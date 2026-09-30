import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';
import { createTeamApi } from '@indyzai/feature-organization/team-api';
import { requestPos } from '../../core/api/posApi';

export const teamApi = createTeamApi({
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
});
