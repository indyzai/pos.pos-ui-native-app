import { useLocalDatabase } from '@indyzai/pos-database/react';
import { createScopeKey, type LocalDatabase } from '@indyzai/pos-database';
import {
  createNativeOfflineEntityCoordinator,
  OfflineTableName,
  useNativeOfflineEntity,
  type OfflineEntityApi,
  type OfflineSyncAdapter,
  type UseOfflineEntityOptions,
} from '@indyzai/pos-database/offline-entity-hook';

export {
  getEntityApi,
  OfflineTableName,
  registerEntityApi,
  registerEntityApiFactory,
} from '@indyzai/pos-database/offline-entity-hook';
export type {
  EntityApiFactory,
  OfflineEntityApi,
  OfflineSyncAdapter,
} from '@indyzai/pos-database/offline-entity-hook';

/** App binding for the shared entity hook; the database profile comes from this app. */
export function useAppOfflineEntity<
  TPayload,
  TListItem = TPayload,
  TCreateInput = Partial<TPayload>,
  TUpdateInput = Partial<TPayload>,
  TFilter = Record<string, unknown>,
>(
  options: Omit<
    UseOfflineEntityOptions<TPayload, TListItem, TCreateInput, TUpdateInput, TFilter>,
    'repository' | 'scope' | 'tenantId'
  >,
) {
  const { database, scope, status } = useLocalDatabase();
  return useNativeOfflineEntity({
    ...options,
    database: status === 'ready' ? database : null,
    scope: scope ? createScopeKey(scope) : 'database:pending',
    tenantId: scope?.tenantId ?? '',
  });
}

/** Worker entry point for replaying entity mutations without mounting React. */
export function createAppOfflineEntityCoordinator<
  TPayload,
  TCreateInput = Partial<TPayload>,
  TUpdateInput = Partial<TPayload>,
  TFilter = Record<string, unknown>,
>(options: {
  database: LocalDatabase;
  tableName: OfflineTableName;
  storeId?: string | null;
  adapter?: OfflineSyncAdapter<TPayload, TCreateInput, TUpdateInput, TFilter>;
  api?: OfflineEntityApi<TPayload, TCreateInput, TUpdateInput, TFilter>;
  online?: () => boolean;
}) {
  const scope = options.database.scope;
  return createNativeOfflineEntityCoordinator({
    ...options,
    context: {
      scope: createScopeKey(scope),
      tenantId: scope.tenantId,
      storeId: options.storeId,
    },
  });
}
