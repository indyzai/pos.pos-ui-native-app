export { createLocalDatabase } from './localDatabase';
export {
    useLocalCollection,
    useLocalCustomers,
    useLocalPayments,
    useLocalProducts,
    useLocalRecord,
    useLocalSales,
    useLocalStockBalances,
    usePendingSync,
} from './hooks';
export { useLocalDatabase, useRequiredLocalDatabase } from './DatabaseProvider';
export { getRoleDataManifest } from './roleManifest';
export { payloadsFromRecords, replaceLocalPayloads } from './projections';
export { createScopeKey, normalizePosRole, posRoles } from './types';
export type {
    CollectionName,
    CollectionRepository,
    DatabaseScope,
    LocalDatabase,
    LocalQuery,
    LocalRecord,
    PosRole,
    SyncStatus,
} from './types';
