import { describe, expect, test } from "bun:test";
import { createSyncCoordinator } from "../src/coordinator";
import type {
    LocalMutation,
    LocalRecord,
    OfflineRepository,
} from "../src/types";

const context = {
    scope: "tenant-a:user-1",
    tenantId: "tenant-a",
    storeId: null,
};
type Product = { name: string };

function fixture() {
    const record: LocalRecord<Product> = {
        id: "local-1",
        ...context,
        remoteId: null,
        payload: { name: "Phone" },
        serverVersion: 0,
        syncStatus: "PENDING",
        updatedAt: 1,
    };
    const job: LocalMutation = {
        id: "job-1",
        tableName: "products",
        recordId: record.id,
        type: "CREATE",
        idempotencyKey: "stable-key",
        status: "PENDING",
        createdAt: 1,
        updatedAt: 1,
        retryCount: 0,
        input: { name: "Phone" },
        ...context,
    };
    const repository = {
        async getById() {
            return record;
        },
        async listMutations() {
            return [job];
        },
        async updateMutation(_id: string, changes: Partial<LocalMutation>) {
            Object.assign(job, changes);
        },
        async updateRecord(
            _table: string,
            _id: string,
            changes: Partial<LocalRecord<Product>>,
        ) {
            Object.assign(record, changes);
        },
        async acknowledgeMutation(
            _job: LocalMutation,
            remote: { remoteId: string; serverVersion: number },
        ) {
            record.remoteId = remote.remoteId;
            record.serverVersion = remote.serverVersion;
            record.syncStatus = "SYNCED";
            job.status = "SYNCED";
        },
    } as unknown as OfflineRepository<Product>;
    return { record, job, repository };
}

describe("offline entity coordinator", () => {
    test("reuses the persisted key and prevents duplicate simultaneous sends", async () => {
        const { record, job, repository } = fixture();
        let sends = 0;
        const coordinator = createSyncCoordinator({
            repository,
            context,
            tableName: "products",
            adapter: {
                async create({ idempotencyKey }) {
                    expect(idempotencyKey).toBe("stable-key");
                    sends++;
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    return {
                        remoteId: "42",
                        payload: { name: "Phone" },
                        serverVersion: 1,
                        updatedAt: 2,
                    };
                },
            },
        });
        await Promise.all([
            coordinator.syncRecord({ tableName: "products", id: record.id }),
            coordinator.syncRecord({ tableName: "products", id: record.id }),
        ]);
        expect(sends).toBe(1);
        expect(job.status).toBe("SYNCED");
        expect(record.remoteId).toBe("42");
    });

    test("retains failed work and retries with the same key", async () => {
        const { record, job, repository } = fixture();
        let sends = 0;
        const coordinator = createSyncCoordinator({
            repository,
            context,
            tableName: "products",
            adapter: {
                async create({ idempotencyKey }) {
                    expect(idempotencyKey).toBe("stable-key");
                    if (++sends === 1) throw new Error("network");
                    return {
                        remoteId: "42",
                        payload: { name: "Phone" },
                        serverVersion: 1,
                        updatedAt: 2,
                    };
                },
            },
        });
        await expect(
            coordinator.syncRecord({ tableName: "products", id: record.id }),
        ).rejects.toThrow("network");
        expect(job.status).toBe("FAILED");
        await coordinator.syncRecord({ tableName: "products", id: record.id });
        expect(sends).toBe(2);
        expect(job.status).toBe("SYNCED");
    });

    test("uncertain outcome requires reconciliation before another send", async () => {
        const { record, job, repository } = fixture();
        let sends = 0;
        const coordinator = createSyncCoordinator({
            repository,
            context,
            tableName: "products",
            adapter: {
                async create() {
                    sends++;
                    throw Object.assign(new Error("uncertain"), {
                        code: "UNCERTAIN_OUTCOME",
                    });
                },
            },
        });
        await expect(
            coordinator.syncRecord({ tableName: "products", id: record.id }),
        ).rejects.toThrow("uncertain");
        expect(job.status).toBe("CONFLICT");
        await coordinator.syncPending({ ...context, tableName: "products" });
        expect(sends).toBe(1);
    });
});
