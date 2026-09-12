import Dexie, { type Table } from "dexie";
import {
    collectionNames,
    type CollectionName,
    type LocalRecord,
} from "../../types";

const indexes =
    "id, scope, tenantId, storeId, remoteId, syncStatus, updatedAt, [scope+storeId], [scope+syncStatus]";

export class PosIndexedDb extends Dexie {
    constructor() {
        super("indyz-pos-local-v1");
        this.version(1).stores(
            Object.fromEntries(collectionNames.map((name) => [name, indexes])),
        );
    }

    records<T extends LocalRecord = LocalRecord>(
        name: CollectionName,
    ): Table<T, string> {
        return this.table<T, string>(name);
    }
}

export async function clearIndexedDbLocalData(): Promise<void> {
    const database = new PosIndexedDb();
    await database.open();
    await database.transaction("rw", database.tables, async () => {
        await Promise.all(database.tables.map((table) => table.clear()));
    });
    database.close();
}
