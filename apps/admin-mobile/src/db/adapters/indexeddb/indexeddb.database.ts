import { liveQuery } from 'dexie';
import { assertCollectionAllowed, getRoleDataManifest } from '../../roleManifest';
import {
    collectionNames,
    createScopeKey,
    type CollectionName,
    type CollectionRepository,
    type DatabaseScope,
    type LocalDatabase,
    type LocalQuery,
    type LocalRecord,
} from '../../types';
import { PosIndexedDb } from './indexeddb.client';

class IndexedDbCollection<T extends LocalRecord> implements CollectionRepository<T> {
    private readonly scopeKey: string;

    constructor(
        private readonly database: PosIndexedDb,
        private readonly name: CollectionName,
        scope: DatabaseScope,
    ) {
        this.scopeKey = createScopeKey(scope);
    }

    private table() {
        return this.database.records<T>(this.name);
    }

    async get(id: string) {
        const row = await this.table().get(id);
        return row?.scope === this.scopeKey ? row : undefined;
    }

    async list(query: LocalQuery = {}) {
        let rows = await this.table().where('scope').equals(this.scopeKey).toArray();
        if (query.storeId) rows = rows.filter((row) => row.storeId === query.storeId);
        if (query.syncStatus) rows = rows.filter((row) => row.syncStatus === query.syncStatus);
        if (!query.includeDeleted) rows = rows.filter((row) => !row.deletedAt);
        rows.sort((left, right) => right.updatedAt - left.updatedAt);
        return query.limit ? rows.slice(0, query.limit) : rows;
    }

    async put(record: T) {
        this.assertScope(record);
        await this.table().put(record);
    }

    async putMany(records: readonly T[]) {
        records.forEach((record) => this.assertScope(record));
        await this.table().bulkPut([...records]);
    }

    async remove(id: string) {
        const row = await this.get(id);
        if (row) await this.table().delete(id);
    }

    async replace(records: readonly T[]) {
        records.forEach((record) => this.assertScope(record));
        await this.database.transaction('rw', this.table(), async () => {
            await this.table().where('scope').equals(this.scopeKey).delete();
            await this.table().bulkPut([...records]);
        });
    }

    subscribe(listener: () => void) {
        const subscription = liveQuery(() =>
            this.table().where('scope').equals(this.scopeKey).count(),
        ).subscribe({
            next: listener,
            error: listener,
        });
        return () => subscription.unsubscribe();
    }

    private assertScope(record: T) {
        if (record.scope !== this.scopeKey) throw new Error(`Record ${record.id} belongs to another scope.`);
    }
}

export class IndexedDbLocalDatabase implements LocalDatabase {
    readonly kind = 'indexeddb' as const;
    private readonly database = new PosIndexedDb();
    private readonly repositories = new Map<CollectionName, CollectionRepository>();

    constructor(readonly scope: DatabaseScope) {}

    async initialize() {
        await this.database.open();
        await this.purgeDisallowed(getRoleDataManifest(this.scope).collections);
    }

    collection<T extends LocalRecord = LocalRecord>(name: CollectionName): CollectionRepository<T> {
        assertCollectionAllowed(this.scope, name);
        let repository = this.repositories.get(name);
        if (!repository) {
            repository = new IndexedDbCollection(this.database, name, this.scope);
            this.repositories.set(name, repository);
        }
        return repository as CollectionRepository<T>;
    }

    transaction<T>(collections: readonly CollectionName[], work: () => Promise<T> | T): Promise<T> {
        collections.forEach((name) => assertCollectionAllowed(this.scope, name));
        return this.database.transaction(
            'rw',
            collections.map((name) => this.database.records(name)),
            work,
        );
    }

    async purgeDisallowed(allowed: ReadonlySet<CollectionName>) {
        const scopeKey = createScopeKey(this.scope);
        await this.database.transaction(
            'rw',
            collectionNames.map((name) => this.database.records(name)),
            async () => {
                for (const name of collectionNames) {
                    const table = this.database.records(name);
                    const rows = await table.where('tenantId').equals(this.scope.tenantId).toArray();
                    const removable = rows
                        .filter(
                            (row) =>
                                row.syncStatus === 'SYNCED' && (!allowed.has(name) || row.scope !== scopeKey),
                        )
                        .map((row) => row.id);
                    await table.bulkDelete(removable);
                }
            },
        );
    }

    async clear() {
        await this.database.transaction('rw', this.database.tables, async () => {
            await Promise.all(this.database.tables.map((table) => table.clear()));
        });
    }

    async close() {
        this.database.close();
    }
}
