import {
    createScopeKey,
    getActiveDatabase,
    type LocalRecord,
} from "@indyzai/pos-database";
import {
    encodePrintBase64,
    renderNativeDocument,
    type NativePrintDocument,
} from "@indyzai/pos-printing";
import {
    printerTransport,
    type PrinterTarget,
} from "@indyzai/pos-printing-native/transport";
import { SerialQueue } from "@indyzai/pos-sync";
import { nativeConfig, validatePrinter } from "./configuration";
import type { CounterPrinter } from "./types";

export type NativePrintActivity = {
    id: string;
    printerId: string;
    printerName: string;
    counterId: string;
    title: string;
    deliveryState: "SENDING" | "SENT" | "UNCERTAIN";
    copies: number;
    copiesSent: number;
    createdAt: string;
    error?: string;
};
export function printerTarget(printer: CounterPrinter): PrinterTarget {
    validatePrinter(printer);
    const config = nativeConfig(printer);
    return {
        connection: printer.connectionType as PrinterTarget["connection"],
        address: printer.address,
        serviceUuid: config.bluetoothServiceUuid,
        characteristicUuid: config.bluetoothCharacteristicUuid,
        port: Number(printer.port || 9100),
        vendorId: config.usbVendorId,
        productId: config.usbProductId,
        interfaceId: config.usbInterfaceId,
        endpointAddress: config.usbEndpointAddress,
        deviceName: config.usbDeviceName,
    };
}
const queue = new SerialQueue();
/** Never replay physical jobs automatically: SENDING after a restart means uncertain output. */
export function sendNativePrint(
    printer: CounterPrinter,
    document: NativePrintDocument,
) {
    const database = getActiveDatabase();
    return queue.run(async () => {
        if (!database || getActiveDatabase() !== database)
            throw new Error(
                "Workspace changed or local storage is unavailable.",
            );
        if (!printer.isActive) throw new Error("This printer is disabled.");
        const config = nativeConfig(printer),
            bytes = encodePrintBase64(renderNativeDocument(document, config));
        const target = await printerTransport.connect(printerTarget(printer));
        if (getActiveDatabase() !== database)
            throw new Error("Workspace changed.");
        const id = `native-print-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let activity: NativePrintActivity = {
            id,
            printerId: printer.id,
            printerName: printer.name,
            counterId: printer.counterId!,
            title: document.title,
            deliveryState: "SENDING",
            copies: config.copies,
            copiesSent: 0,
            createdAt: new Date().toISOString(),
        };
        const repo =
            database.collection<LocalRecord<NativePrintActivity>>("print_jobs");
        const save = () => {
            if (getActiveDatabase() !== database)
                throw new Error("Workspace changed during printing.");
            return repo.put({
                id,
                scope: createScopeKey(database.scope),
                tenantId: database.scope.tenantId,
                storeId: printer.branchId,
                payload: activity,
                remoteId: id,
                serverVersion: 0,
                syncStatus: "SYNCED",
                updatedAt: Date.now(),
            });
        };
        await save();
        try {
            for (let copy = 0; copy < config.copies; copy++) {
                if (getActiveDatabase() !== database)
                    throw new Error("Workspace changed during printing.");
                await printerTransport.write(target, bytes);
                activity = { ...activity, copiesSent: copy + 1 };
                await save();
            }
            activity = { ...activity, deliveryState: "SENT" };
            await save();
            return activity;
        } catch (error) {
            activity = {
                ...activity,
                deliveryState: "UNCERTAIN",
                error:
                    error instanceof Error
                        ? error.message
                        : "Printer connection interrupted.",
            };
            // An account switch must never write into the new account's database.
            if (getActiveDatabase() === database) await save();
            throw new Error(
                `Print outcome uncertain. Check the paper before reprinting. ${activity.error}`,
            );
        }
    });
}
