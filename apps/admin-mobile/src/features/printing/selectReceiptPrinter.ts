import type { CounterPrinter } from './types';

export function receiptPrinters(printers: CounterPrinter[], counterId: string) {
    return printers.filter(
        (printer) =>
            (!printer.counterId || printer.counterId === counterId) &&
            printer.isActive &&
            (printer.type.toLowerCase() === 'receipt' ||
                printer.printerTypes?.some((type) => type.toLowerCase() === 'receipt')),
    );
}

export function selectReceiptPrinter(printers: CounterPrinter[], counterId: string) {
    const eligible = receiptPrinters(printers, counterId);
    return eligible.find((printer) => printer.isDefault) ?? eligible[0];
}

export function selectAutoPrintReceiptPrinter(printers: CounterPrinter[], counterId: string) {
    const eligible = receiptPrinters(printers, counterId).filter((printer) => printer.autoPrint);
    return eligible.find((printer) => printer.isDefault) ?? eligible[0];
}
