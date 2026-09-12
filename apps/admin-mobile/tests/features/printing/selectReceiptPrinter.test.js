import { expect, test } from 'bun:test';
import {
    selectAutoPrintReceiptPrinter,
    selectReceiptPrinter,
} from '../../../src/features/printing/selectReceiptPrinter';

const printer = (overrides = {}) => ({
    id: '1',
    name: 'Receipt',
    counterId: '10',
    type: 'receipt',
    printerTypes: ['receipt'],
    status: 'online',
    isDefault: false,
    isActive: true,
    copies: 1,
    autoPrint: false,
    ...overrides,
});

test('auto print requires an eligible printer with auto print enabled', () => {
    expect(
        selectAutoPrintReceiptPrinter([printer(), printer({ id: 'auto', autoPrint: true })], '10')?.id,
    ).toBe('auto');
    expect(selectAutoPrintReceiptPrinter([printer()], '10')).toBeUndefined();
});

test('prefers the active default receipt printer for the counter', () => {
    expect(selectReceiptPrinter([printer(), printer({ id: '2', isDefault: true })], '10')?.id).toBe('2');
});

test('excludes inactive, unrelated, and non-receipt printers', () => {
    expect(
        selectReceiptPrinter(
            [
                printer({ id: 'inactive', isActive: false }),
                printer({ id: 'other', counterId: '11' }),
                printer({ id: 'label', type: 'barcode', printerTypes: ['barcode'] }),
            ],
            '10',
        ),
    ).toBeUndefined();
});
