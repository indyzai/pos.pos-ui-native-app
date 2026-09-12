import Dexie, { type Table } from "dexie";
import type { CollectionName, LocalRecord } from "../../types";

const indexes =
    "id, scope, tenantId, storeId, remoteId, syncStatus, updatedAt, [scope+storeId], [scope+syncStatus]";

export class PosIndexedDb extends Dexie {
    constructor(databaseName: string, collections: readonly CollectionName[]) {
        super(databaseName);
        this.version(1).stores(
            Object.fromEntries(collections.map((name) => [name, indexes])),
        );
    }

    records<T extends LocalRecord = LocalRecord>(
        name: CollectionName,
    ): Table<T, string> {
        return this.table<T, string>(name);
    }
}

export async function clearIndexedDbLocalData(
    databaseName: string,
    collections: readonly CollectionName[],
): Promise<void> {
    const database = new PosIndexedDb(databaseName, collections);
    await database.open();
    await database.transaction("rw", database.tables, async () => {
        await Promise.all(database.tables.map((table) => table.clear()));
    });
    database.close();
}
