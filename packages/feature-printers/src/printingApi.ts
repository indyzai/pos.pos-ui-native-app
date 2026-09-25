import {
    assertFeatureContext,
    type FeatureContext,
    type FeatureRequest,
} from "@indyzai/pos-application";
import { SerialQueue } from "@indyzai/pos-sync";
import type { NativePrintDocument } from "@indyzai/pos-printing";
import type { CounterPrinter, LocalPrintJob, PrintJob } from "./types";
import {
    receiptPrinters,
    selectReceiptPrinter,
    selectAutoPrintReceiptPrinter,
} from "./selectReceiptPrinter";

export interface PrintingApiOptions {
    refreshCachedPrinters?: (counterId: string) => Promise<void>;
    deliverNative?: (
        printer: CounterPrinter,
        document: NativePrintDocument,
    ) => Promise<unknown>;
    getContext: () => FeatureContext;
    request: FeatureRequest;
    createId: () => string;
    readPrinters: (scope: string) => Promise<CounterPrinter[]>;
    replacePrinters: (
        scope: string,
        printers: CounterPrinter[],
    ) => Promise<void>;
    listPendingPrintJobs: (scope: string) => Promise<LocalPrintJob[]>;
    savePrintJob: (scope: string, job: LocalPrintJob) => Promise<void>;
}

export function createPrintingApi(options: PrintingApiOptions) {
    const queue = new SerialQueue();
    const assertCurrent = (context: FeatureContext) =>
        assertFeatureContext(context, options.getContext());
    async function submit(
        context: FeatureContext,
        job: LocalPrintJob,
    ): Promise<LocalPrintJob> {
        assertCurrent(context);
        try {
            const data = await options.request<{ createPrinterJob: PrintJob }>(
                context.token,
                context.tenant,
                `mutation QueueReceiptPrint($input: CreatePrinterJobInput!) { createPrinterJob(input: $input) { id printerId printerName status copies createdAt } }`,
                {
                    input: {
                        printerId: job.printerId,
                        counterId: job.counterId,
                        branchId: job.branchId,
                        documentType: "receipt",
                        invoiceNumber: job.invoiceNumber,
                        copies: job.copies,
                    },
                },
            );
            assertCurrent(context);
            if (!data.createPrinterJob?.id)
                throw new Error("Server did not acknowledge the print job.");
            job.serverId = data.createPrinterJob.id;
            job.status =
                data.createPrinterJob.status.toUpperCase() === "COMPLETED"
                    ? "COMPLETED"
                    : "SUBMITTED";
            job.error = undefined;
        } catch (error) {
            assertCurrent(context);
            job.status = "FAILED";
            job.error =
                error instanceof Error
                    ? error.message
                    : "Unable to queue print.";
        }
        assertCurrent(context);
        await options.savePrintJob(context.scope, job);
        return job;
    }
    async function printers(
        context: FeatureContext,
        counterId: string,
        refresh = false,
    ) {
        const cached = await options.readPrinters(context.scope);
        assertCurrent(context);
        if (!refresh) return receiptPrinters(cached, counterId);
        if (options.refreshCachedPrinters) {
            await options.refreshCachedPrinters(counterId);
            assertCurrent(context);
            return receiptPrinters(
                await options.readPrinters(context.scope),
                counterId,
            );
        }
        try {
            const data = await options.request<{
                counterPrinters: CounterPrinter[];
            }>(
                context.token,
                context.tenant,
                `query ReceiptPrinters($counterId: ID) { counterPrinters(counterId: $counterId) { id name counterId branchId type printerTypes connectionType address port paperSize config status isDefault isActive copies autoPrint } }`,
                { counterId },
            );
            assertCurrent(context);
            if (!Array.isArray(data.counterPrinters))
                throw new Error("The printer response is incomplete.");
            // Refreshing one counter must retain other counter assignments in the same local scope.
            const ids = new Set(
                data.counterPrinters.map((printer) => printer.id),
            );
            const retained = cached.filter(
                (printer) =>
                    printer.counterId &&
                    printer.counterId !== counterId &&
                    !ids.has(printer.id),
            );
            await options.replacePrinters(context.scope, [
                ...retained,
                ...data.counterPrinters,
            ]);
            assertCurrent(context);
            return receiptPrinters(
                await options.readPrinters(context.scope),
                counterId,
            );
        } catch (error) {
            assertCurrent(context);
            const eligible = receiptPrinters(cached, counterId);
            if (!eligible.length) throw error;
            return eligible;
        }
    }
    async function createJob(
        context: FeatureContext,
        printer: CounterPrinter,
        invoiceNumber: string,
        counterId: string,
        branchId?: string,
        document?: NativePrintDocument,
    ) {
        assertCurrent(context);
        const job: LocalPrintJob = {
            id: options.createId(),
            printerId: printer.id,
            printerName: printer.name,
            invoiceNumber,
            counterId,
            branchId,
            copies: Math.max(1, Math.min(20, Math.floor(printer.copies || 1))),
            status: "QUEUED",
            createdAt: new Date().toISOString(),
        };
        if (printer.config?.native) {
            if (!document || !options.deliverNative)
                throw new Error(
                    "Receipt content is required for native printing.",
                );
            // The native delivery service persists its own audit before touching hardware.
            // Never enqueue this job with the server's remote printing agent.
            const delivered = await options.deliverNative(printer, document);
            return {
                ...job,
                id:
                    delivered &&
                    typeof delivered === "object" &&
                    "id" in delivered
                        ? String(delivered.id)
                        : job.id,
                status: "SENT" as const,
            };
        }
        await options.savePrintJob(context.scope, job);
        return submit(context, job);
    }
    return {
        printers: (counterId: string) =>
            printers(options.getContext(), counterId),
        refreshPrinters: (counterId: string) =>
            queue.run(() => printers(options.getContext(), counterId, true)),
        queueReceipt: (
            invoiceNumber: string,
            counterId: string,
            branchId?: string,
            document?: NativePrintDocument,
        ) =>
            queue.run(async () => {
                const context = options.getContext();
                const printer = selectReceiptPrinter(
                    await printers(context, counterId),
                    counterId,
                );
                if (!printer)
                    throw new Error(
                        "No active receipt printer is assigned to this counter.",
                    );
                return createJob(
                    context,
                    printer,
                    invoiceNumber,
                    counterId,
                    branchId,
                    document,
                );
            }),
        autoQueueReceipt: (
            invoiceNumber: string,
            counterId: string,
            branchId?: string,
            document?: NativePrintDocument,
        ) =>
            queue.run(async () => {
                const context = options.getContext();
                const printer = selectAutoPrintReceiptPrinter(
                    await printers(context, counterId),
                    counterId,
                );
                return printer
                    ? createJob(
                          context,
                          printer,
                          invoiceNumber,
                          counterId,
                          branchId,
                          document,
                      )
                    : undefined;
            }),
        syncPending: () =>
            queue.run(async () => {
                const context = options.getContext();
                const jobs = await options.listPendingPrintJobs(context.scope);
                assertCurrent(context);
                for (const job of jobs.filter((job) => !job.serverId))
                    await submit(context, job);
                if (!jobs.some((job) => job.serverId)) return;
                const remote = await options.request<{
                    printerJobs: Array<PrintJob & { error?: string }>;
                }>(
                    context.token,
                    context.tenant,
                    `query PrinterActivity { printerJobs { id printerId printerName status copies createdAt error } }`,
                );
                assertCurrent(context);
                for (const job of jobs.filter((job) => job.serverId)) {
                    const status = remote.printerJobs.find(
                        (server) => server.id === job.serverId,
                    );
                    if (!status) continue;
                    job.status =
                        status.status.toUpperCase() === "COMPLETED"
                            ? "COMPLETED"
                            : status.status.toUpperCase() === "FAILED"
                              ? "FAILED"
                              : "SUBMITTED";
                    job.error = status.error;
                    assertCurrent(context);
                    await options.savePrintJob(context.scope, job);
                }
            }),
    };
}
