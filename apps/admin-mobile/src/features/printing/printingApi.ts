import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import type { CounterPrinter, PrintJob } from './types';
import type { LocalPrintJob } from './types';
import * as Crypto from 'expo-crypto';
import { listPendingPrintJobs, savePrintJob } from './printJobRepository';
import { readPrinters, replacePrinters } from './printerRepository';
import { receiptPrinters, selectAutoPrintReceiptPrinter, selectReceiptPrinter } from './selectReceiptPrinter';

const context = () => {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Your workspace is still initializing.');
    return session;
};

const scope = () => {
    const session = context();
    return appStorageKeys.admin.billing(session.user.id, session.tenant.id);
};

async function submit(job: LocalPrintJob) {
    const session = context();
    try {
        const data = await requestPos<{ createPrinterJob: PrintJob }>(
            session.token,
            String(session.tenant.id),
            `mutation QueueReceiptPrint($input: CreatePrinterJobInput!) { createPrinterJob(input: $input) { id printerId printerName status copies createdAt } }`,
            {
                input: {
                    printerId: job.printerId,
                    counterId: job.counterId,
                    branchId: job.branchId,
                    documentType: 'receipt',
                    invoiceNumber: job.invoiceNumber,
                    copies: job.copies,
                },
            },
        );
        if (!data.createPrinterJob?.id) throw new Error('Server did not acknowledge the print job.');
        job.status = 'COMPLETED';
        job.serverId = data.createPrinterJob.id;
        job.error = undefined;
    } catch (error) {
        job.status = 'FAILED';
        job.error = error instanceof Error ? error.message : 'Unable to queue print.';
    }
    await savePrintJob(scope(), job);
    return job;
}

async function createLocalJob(
    printer: CounterPrinter,
    invoiceNumber: string,
    counterId: string,
    branchId?: string,
) {
    const job: LocalPrintJob = {
        id: Crypto.randomUUID(),
        printerId: printer.id,
        printerName: printer.name,
        counterId,
        branchId,
        invoiceNumber,
        copies: Math.max(1, printer.copies || 1),
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
    };
    await savePrintJob(scope(), job);
    return submit(job);
}

export const printingApi = {
    async printers(counterId: string): Promise<CounterPrinter[]> {
        const session = context();
        let available: CounterPrinter[];
        try {
            const data = await requestPos<{ counterPrinters: CounterPrinter[] }>(
                session.token,
                String(session.tenant.id),
                `query ReceiptPrinters($counterId: ID) { counterPrinters(counterId: $counterId) { id name counterId branchId type printerTypes status isDefault isActive copies autoPrint } }`,
                { counterId },
            );
            available = data.counterPrinters ?? [];
            await replacePrinters(scope(), available);
        } catch (error) {
            available = await readPrinters(scope());
            if (!available.length) throw error;
        }
        return receiptPrinters(available, counterId);
    },
    async queueReceipt(invoiceNumber: string, counterId: string, branchId?: string): Promise<LocalPrintJob> {
        const printers = await this.printers(counterId);
        const printer = selectReceiptPrinter(printers, counterId);
        if (!printer) throw new Error('No active receipt printer is assigned to this counter.');
        return createLocalJob(printer, invoiceNumber, counterId, branchId);
    },
    async autoQueueReceipt(invoiceNumber: string, counterId: string, branchId?: string) {
        const printer = selectAutoPrintReceiptPrinter(await this.printers(counterId), counterId);
        return printer ? createLocalJob(printer, invoiceNumber, counterId, branchId) : undefined;
    },
    async syncPending() {
        const jobs = await listPendingPrintJobs(scope());
        for (const job of jobs) await submit(job);
    },
};
