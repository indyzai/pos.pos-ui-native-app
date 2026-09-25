import { expect, mock, test } from "bun:test";
mock.module("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
import {
    clearPendingSales,
    retryPendingSale,
    syncPendingSales,
    type PendingSale,
} from "../src/salesOutbox";

const createMockSale = (id: string, attempts = 0): PendingSale => ({
    id,
    operation: "CREATE",
    payload: { id },
    input: { offlineId: id, totalAmount: 100 },
    receiptNumber: `REC-${id}`,
    createdAt: new Date().toISOString(),
    attempts,
});

test("syncPendingSales stops replay after 3 failed attempts", async () => {
    const sale = createMockSale("sale-1");
    const queue: PendingSale[] = [sale];
    let persistCount = 0;
    const persist = async () => {
        persistCount++;
    };

    let requestCount = 0;
    const failingRequest = async () => {
        requestCount++;
        throw new Error("Network unreachable");
    };

    // 1st failure
    await expect(syncPendingSales(queue, failingRequest, persist)).rejects.toThrow("Network unreachable");
    expect(sale.attempts).toBe(1);
    expect(sale.error).toBe("Network unreachable");
    expect(queue).toHaveLength(1);

    // 2nd failure
    await expect(syncPendingSales(queue, failingRequest, persist)).rejects.toThrow("Network unreachable");
    expect(sale.attempts).toBe(2);
    expect(queue).toHaveLength(1);

    // 3rd failure
    await expect(syncPendingSales(queue, failingRequest, persist)).rejects.toThrow("Network unreachable");
    expect(sale.attempts).toBe(3);
    expect(queue).toHaveLength(1);

    // 4th call: stops running without making a network request
    const beforeRequestCount = requestCount;
    await syncPendingSales(queue, failingRequest, persist);
    expect(requestCount).toBe(beforeRequestCount);
    expect(queue).toHaveLength(1);
});

test("retryPendingSale resets attempts and clears error", async () => {
    const sale = createMockSale("sale-1", 3);
    sale.error = "Previous failure";

    retryPendingSale(sale);
    expect(sale.attempts).toBe(0);
    expect(sale.error).toBeUndefined();

    // After reset, it can be retried and synced successfully
    const queue: PendingSale[] = [sale];
    const successfulRequest = async <T>() => ({ saveBill: { id: "bill-99", billId: "B-99" } }) as T;
    let synced = false;
    await syncPendingSales(queue, successfulRequest, async () => {}, async () => {
        synced = true;
    });
    expect(synced).toBe(true);
    expect(queue).toHaveLength(0);
});

test("clearPendingSales empties the queue", () => {
    const queue: PendingSale[] = [createMockSale("1"), createMockSale("2")];
    clearPendingSales(queue);
    expect(queue).toHaveLength(0);
});
