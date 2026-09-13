import { addDatabaseChangeListener, type SQLiteDatabase } from "expo-sqlite";
import { getDatabase, getSQLiteClient } from "../../client";
import { initializeDatabase } from "../../migrations";
import {
    assertCollectionAllowed,
    getRoleDataManifest,
} from "../../../roleManifest";
import {
    collectionNames,
    createScopeKey,
    type CollectionName,
    type CollectionRepository,
    type DatabaseScope,
    type LocalDatabase,
    type LocalQuery,
    type LocalRecord,
} from "../../../types";

type Column = {
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
};
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const camel = (value: string) =>
    value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

class SqliteCollection<
    T extends LocalRecord,
> implements CollectionRepository<T> {
    private readonly scopeKey: string;
    private columns?: Column[];

    constructor(
        private readonly sqlite: SQLiteDatabase,
        private readonly name: CollectionName,
        scope: DatabaseScope,
    ) {
        this.scopeKey = createScopeKey(scope);
    }

    private getColumns() {
        return (this.columns ??= this.sqlite.getAllSync<Column>(
            `PRAGMA table_info(${quote(this.name)})`,
        ));
    }

    async get(id: string) {
        const row = this.sqlite.getFirstSync<Record<string, unknown>>(
            `SELECT * FROM ${quote(this.name)} WHERE id = ? AND scope = ? LIMIT 1`,
            id,
            this.scopeKey,
        );
        return row ? this.fromRow(row) : undefined;
    }

    async list(query: LocalQuery = {}) {
        const columns = new Set(this.getColumns().map((column) => column.name));
        const where = ["scope = ?"];
        const args: (string | number)[] = [this.scopeKey];
        if (query.storeId && columns.has("store_id")) {
            where.push("store_id = ?");
            args.push(query.storeId);
        }
        if (query.syncStatus && columns.has("sync_status")) {
            where.push("sync_status = ?");
            args.push(query.syncStatus);
        }
        if (!query.includeDeleted && columns.has("deleted_at"))
            where.push("deleted_at IS NULL");
        const order = columns.has("updated_at")
            ? " ORDER BY updated_at DESC"
            : "";
        const limit = query.limit
            ? ` LIMIT ${Math.max(1, Math.floor(query.limit))}`
            : "";
        return this.sqlite
            .getAllSync<Record<string, unknown>>(
                `SELECT * FROM ${quote(this.name)} WHERE ${where.join(" AND ")}${order}${limit}`,
                ...args,
            )
            .map((row) => this.fromRow(row));
    }

    private putSync(record: T) {
        this.assertScope(record);
        const values = this.toRow(record);
        const names = Object.keys(values);
        const updates = names
            .filter((name) => name !== "id")
            .map((name) => `${quote(name)} = excluded.${quote(name)}`);
        this.sqlite.runSync(
            `INSERT INTO ${quote(this.name)} (${names.map(quote).join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`,
            ...(Object.values(values) as (string | number | null)[]),
        );
    }

    async put(record: T) {
        this.putSync(record);
    }

    async putMany(records: readonly T[]) {
        this.sqlite.withTransactionSync(() =>
            records.forEach((record) => this.putSync(record)),
        );
    }

    async remove(id: string) {
        this.sqlite.runSync(
            `DELETE FROM ${quote(this.name)} WHERE id = ? AND scope = ?`,
            id,
            this.scopeKey,
        );
    }

    async replace(records: readonly T[]) {
        records.forEach((record) => this.assertScope(record));
        this.sqlite.withTransactionSync(() => {
            this.sqlite.runSync(
                `DELETE FROM ${quote(this.name)} WHERE scope = ?`,
                this.scopeKey,
            );
            records.forEach((record) => this.putSync(record));
        });
    }

    subscribe(listener: () => void) {
        const subscription = addDatabaseChangeListener((event) => {
            if (event.tableName === this.name) listener();
        });
        return () => subscription.remove();
    }

    private assertScope(record: T) {
        if (record.scope !== this.scopeKey)
            throw new Error(`Record ${record.id} belongs to another scope.`);
    }

    private toRow(record: T): Record<string, string | number | null> {
        const payload = record.payload as Record<string, unknown>;
        const known: Record<string, unknown> = {
            id: record.id,
            scope: record.scope,
            tenant_id: record.tenantId,
            store_id: record.storeId ?? null,
            remote_id: record.remoteId ?? record.id,
            offline_id: record.id,
            payload: JSON.stringify(record.payload),
            server_version: record.serverVersion,
            sync_status: record.syncStatus,
            status: record.syncStatus,
            updated_at: record.updatedAt,
            created_at: record.updatedAt,
            deleted_at: record.deletedAt ?? null,
        };
        const result: Record<string, string | number | null> = {};
        for (const column of this.getColumns()) {
            let value = known[column.name] ?? payload[camel(column.name)];
            if (
                value === undefined &&
                column.notnull &&
                column.dflt_value === null
            ) {
                value = column.type.toUpperCase().includes("INT") ? 0 : "";
            }
            if (value !== undefined)
                result[column.name] =
                    typeof value === "boolean"
                        ? value
                            ? 1
                            : 0
                        : typeof value === "object"
                          ? JSON.stringify(value)
                          : (value as string | number | null);
        }
        return result;
    }

    private fromRow(row: Record<string, unknown>): T {
        let payload: Record<string, unknown> = {};
        if (typeof row.payload === "string") {
            try {
                payload = JSON.parse(row.payload) as Record<string, unknown>;
            } catch {
                payload = {};
            }
        }
        for (const [name, value] of Object.entries(row)) {
            if (
                ![
                    "id",
                    "scope",
                    "tenant_id",
                    "store_id",
                    "remote_id",
                    "server_version",
                    "sync_status",
                    "updated_at",
                    "deleted_at",
                    "payload",
                ].includes(name)
            ) {
                if (
                    typeof value === "string" &&
                    (value.startsWith("{") || value.startsWith("["))
                ) {
                    try {
                        payload[camel(name)] = JSON.parse(value);
                    } catch {
                        payload[camel(name)] = value;
                    }
                } else {
                    payload[camel(name)] =
                        name === "quick" ? Boolean(value) : value;
                }
            }
        }
        payload.id ??= String(row.remote_id ?? row.id);
        return {
            id: String(row.id),
            scope: String(row.scope),
            tenantId: String(row.tenant_id ?? ""),
            storeId: row.store_id == null ? null : String(row.store_id),
            remoteId: row.remote_id == null ? null : String(row.remote_id),
            payload,
            serverVersion: Number(row.server_version ?? 0),
            syncStatus: String(
                row.sync_status ?? row.status ?? "SYNCED",
            ) as T["syncStatus"],
            updatedAt: Number(
                row.updated_at ??
                    (Date.parse(String(row.created_at ?? 0)) || 0),
            ),
            deletedAt: row.deleted_at == null ? null : Number(row.deleted_at),
        } as T;
    }
}

export class SqliteLocalDatabase implements LocalDatabase {
    readonly kind = "sqlite" as const;
    readonly orm = getDatabase();
    private readonly sqlite = getSQLiteClient();
    private readonly repositories = new Map<
        CollectionName,
        CollectionRepository
    >();

    constructor(readonly scope: DatabaseScope) {}

    async initialize() {
        initializeDatabase(this.scope.appProfile ?? "store");
        await this.purgeDisallowed(getRoleDataManifest(this.scope).collections);
    }

    collection<T extends LocalRecord = LocalRecord>(
        name: CollectionName,
    ): CollectionRepository<T> {
        assertCollectionAllowed(this.scope, name);
        let repository = this.repositories.get(name);
        if (!repository) {
            repository = new SqliteCollection(this.sqlite, name, this.scope);
            this.repositories.set(name, repository);
        }
        return repository as CollectionRepository<T>;
    }

    async transaction<T>(
        collections: readonly CollectionName[],
        work: () => Promise<T> | T,
    ) {
        collections.forEach((name) =>
            assertCollectionAllowed(this.scope, name),
        );
        // Expo's exclusive async transaction keeps all awaited repository calls on this connection.
        let result!: T;
        await this.sqlite.withExclusiveTransactionAsync(async () => {
            result = await work();
        });
        return result;
    }

    async purgeDisallowed(allowed: ReadonlySet<CollectionName>) {
        const scopeKey = createScopeKey(this.scope);
        this.sqlite.withTransactionSync(() => {
            for (const name of collectionNames) {
                const columns = this.sqlite.getAllSync<Column>(
                    `PRAGMA table_info(${quote(name)})`,
                );
                const names = new Set(columns.map((column) => column.name));
                if (!names.has("sync_status") || !names.has("tenant_id"))
                    continue;
                this.sqlite.runSync(
                    allowed.has(name)
                        ? `DELETE FROM ${quote(name)} WHERE tenant_id = ? AND scope <> ? AND sync_status = 'SYNCED'`
                        : `DELETE FROM ${quote(name)} WHERE tenant_id = ? AND sync_status = 'SYNCED'`,
                    ...(allowed.has(name)
                        ? [this.scope.tenantId, scopeKey]
                        : [this.scope.tenantId]),
                );
            }
        });
    }

    async clear() {
        this.sqlite.withTransactionSync(() => {
            for (const name of collectionNames)
                this.sqlite.runSync(`DELETE FROM ${quote(name)}`);
        });
    }

    async close() {
        // The Expo SQLite client is a process singleton shared by legacy repositories.
        // It is intentionally kept open until the application process exits.
    }
}
