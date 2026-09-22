import { expect, test } from "bun:test";
import { startBillingOutboxWorker } from "../src/billingOutboxWorker";
import type { LocalDatabase } from "@indyzai/pos-database";

test("simultaneous triggers serialize even while reading pending records", async () => {
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => {
        finish = resolve;
    });
    let pending = true;
    let pushes = 0;
    const db = {
        collection: () => ({
            list: async () => {
                await ready;
                return pending
                    ? [
                          {
                              payload: { entityType: "SALE" },
                              syncStatus: "PENDING",
                          },
                      ]
                    : [];
            },
            subscribe: () => () => {},
        }),
    } as unknown as LocalDatabase;
    const worker = startBillingOutboxWorker(
        db,
        async () => {
            pushes++;
            pending = false;
        },
        async () => true,
    );
    try {
        const first = worker.runNow();
        expect(await worker.runNow()).toBe("busy");
        finish();
        expect(await first).toBe("synced");
        expect(pushes).toBe(1);
    } finally {
        worker.stop();
    }
});

test("offline triggers preserve the queue and do not push", async () => {
    let pushes = 0;
    const db = {
        collection: () => ({
            list: async () => [
                { payload: { entityType: "SALE" }, syncStatus: "PENDING" },
            ],
            subscribe: () => () => {},
        }),
    } as unknown as LocalDatabase;
    const worker = startBillingOutboxWorker(
        db,
        async () => {
            pushes++;
        },
        async () => false,
    );
    try {
        expect(await worker.runNow()).toBe("offline");
        expect(pushes).toBe(0);
    } finally {
        worker.stop();
    }
});

test("customer-only queues wake the worker and completed jobs do not", async () => {
    let status = "RUNNING";
    let pushes = 0;
    const db = {
        collection: () => ({
            list: async () => [
                { payload: { entityType: "CUSTOMER" }, syncStatus: status },
            ],
            subscribe: () => () => {},
        }),
    } as unknown as LocalDatabase;
    const worker = startBillingOutboxWorker(
        db,
        async () => {
            pushes++;
            status = "SYNCED";
        },
        async () => true,
    );
    try {
        expect(await worker.runNow()).toBe("synced");
        expect(await worker.runNow()).toBe("empty");
        expect(pushes).toBe(1);
    } finally {
        worker.stop();
    }
});
