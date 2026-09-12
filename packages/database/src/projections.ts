import {
    createScopeKey,
    type CollectionName,
    type LocalDatabase,
    type LocalRecord,
} from "./types";

export async function replaceLocalPayloads<T extends { id: string }>(
    database: LocalDatabase,
    collection: CollectionName,
    payloads: readonly T[],
): Promise<void> {
    const scope = database.scope;
    const scopeKey = createScopeKey(scope);
    const now = Date.now();
    const records: LocalRecord<T>[] = payloads.map((payload) => {
        const metadata = payload as T & {
            serverVersion?: number;
            updatedAt?: number | string;
            status?: string;
        };
        const sourceStatus = String(metadata.status ?? "").toUpperCase();
        const syncStatus =
            sourceStatus === "FAILED"
                ? "FAILED"
                : sourceStatus.includes("PENDING")
                  ? "PENDING"
                  : "SYNCED";
        return {
            id: `${scopeKey}:${collection}:${payload.id}`,
            scope: scopeKey,
            tenantId: scope.tenantId,
            storeId: scope.storeIds[0] ?? null,
            remoteId: payload.id,
            payload,
            serverVersion: Number(metadata.serverVersion ?? 0),
            syncStatus,
            updatedAt:
                typeof metadata.updatedAt === "string"
                    ? Date.parse(metadata.updatedAt) || now
                    : Number(metadata.updatedAt ?? now),
            deletedAt: null,
        };
    });
    await database.collection<LocalRecord<T>>(collection).replace(records);
}

export const payloadsFromRecords = <T>(
    records: readonly LocalRecord<T>[],
): T[] => records.map((record) => record.payload);
