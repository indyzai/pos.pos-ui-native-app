import { expect, test } from 'bun:test';
import { provisionalReceiptNumber } from '../../../src/features/billing/domain/receiptNumber';

test('builds a readable scoped provisional receipt number', () => {
    expect(
        provisionalReceiptNumber(
            '12345678-abcd-efgh-ijkl-987654321abc',
            '2026-09-11T10:00:00.000Z',
            ' demo / sale ',
            'counter-0012',
        ),
    ).toBe('DEMOSALE-20260911-0012-321ABC');
});

test('uses safe defaults for invalid input', () => {
    expect(provisionalReceiptNumber('abc123', 'invalid')).toBe('POS-00000000-0-ABC123');
});
