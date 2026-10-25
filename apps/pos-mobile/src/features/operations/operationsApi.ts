import * as Crypto from 'expo-crypto';
import { createOperationsApi } from '@indyzai/feature-organization/operations-api';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createScopeKey, getActiveDatabase } from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';
export const operationsApi = createOperationsApi({
  request: requestPos,
  createId: Crypto.randomUUID,
  getContext: () => {
    const session = getActiveAuthSession(),
      database = getActiveDatabase();
    if (!session || !database || database.scope.tenantId !== String(session.tenant.id))
      throw new Error('Your workspace is still initializing.');
    const counter = session.organization?.activeSession;
    return {
      database,
      scope: createScopeKey(database.scope),
      tenant: String(session.tenant.id),
      token: session.token,
      role: database.scope.role,
      branchIds: session.organization?.branches.map((branch) => branch.id),
      branchId: counter?.branchId,
      counterId: counter?.counterId,
      counterSessionId: counter?.id,
    };
  },
});
