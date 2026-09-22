import { expect, test } from "bun:test";
import { createPrintingApi, type PrintingApiOptions } from "../src/printingApi";
import type { LocalPrintJob, CounterPrinter } from "../src/types";

const printer: CounterPrinter = {
    id: "p1",
    name: "Front",
    counterId: "c1",
    type: "receipt",
    printerTypes: ["receipt"],
    status: "ONLINE",
    isDefault: true,
    isActive: true,
    copies: 1,
    autoPrint: true,
};

test("server acceptance remains submitted until completion and is never resubmitted", async () => {
    const stored = new Map<string, LocalPrintJob>();
    let submissions = 0;
    const request: PrintingApiOptions["request"] = async <T>(
        _token: string,
        _tenant: string,
        query: string,
    ) => {
        if (query.includes("QueueReceiptPrint")) {
            submissions++;
            return {
                createPrinterJob: { id: "server1", status: "QUEUED" },
            } as T;
        }
        return { printerJobs: [{ id: "server1", status: "COMPLETED" }] } as T;
    };
    const api = createPrintingApi({
        request,
        createId: () => "job1",
        getContext: () => ({ scope: "pos:u:t", tenant: "t", token: "token" }),
        readPrinters: async () => [printer],
        replacePrinters: async () => {},
        listPendingPrintJobs: async () =>
            [...stored.values()].filter((job) => job.status !== "COMPLETED"),
        savePrintJob: async (scope, job) => {
            expect(scope).toBe("pos:u:t");
            stored.set(job.id, structuredClone(job));
        },
    });
    expect((await api.queueReceipt("invoice1", "c1")).status).toBe("SUBMITTED");
    await api.syncPending();
    expect(stored.get("job1")?.status).toBe("COMPLETED");
    expect(submissions).toBe(1);
});

test("a print response after switching businesses is not written into either active scope", async () => {
    let scope = "pos:u:t";
    let writes = 0;
    const request: PrintingApiOptions["request"] = async <T>() => {
        scope = "pos:u:other";
        return { createPrinterJob: { id: "server1", status: "QUEUED" } } as T;
    };
    const api = createPrintingApi({
        request,
        createId: () => "job1",
        getContext: () => ({ scope, tenant: "t", token: "token" }),
        readPrinters: async () => [printer],
        replacePrinters: async () => {},
        listPendingPrintJobs: async () => [],
        savePrintJob: async () => {
            writes++;
        },
    });
    await expect(api.queueReceipt("invoice1", "c1")).rejects.toThrow(
        "workspace changed",
    );
    expect(writes).toBe(1); // Only the original durable enqueue is allowed.
});
