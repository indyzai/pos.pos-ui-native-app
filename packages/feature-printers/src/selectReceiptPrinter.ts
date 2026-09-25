import type { CounterPrinter } from "./types";

export function receiptPrinters(printers: CounterPrinter[], counterId: string) {
    return printers.filter(
        (printer) =>
            (!printer.counterId || printer.counterId === counterId) &&
            printer.isActive &&
            (["receipt", "thermal"].includes(printer.type.toLowerCase()) ||
                printer.printerTypes?.some((type) =>
                    ["receipt", "thermal"].includes(type.toLowerCase()),
                )),
    );
}

export function selectReceiptPrinter(
    printers: CounterPrinter[],
    counterId: string,
) {
    const eligible = receiptPrinters(printers, counterId);
    return eligible.find((printer) => printer.isDefault) ?? eligible[0];
}

export function selectAutoPrintReceiptPrinter(
    printers: CounterPrinter[],
    counterId: string,
) {
    const eligible = receiptPrinters(printers, counterId).filter(
        (printer) => printer.autoPrint,
    );
    return eligible.find((printer) => printer.isDefault) ?? eligible[0];
}
