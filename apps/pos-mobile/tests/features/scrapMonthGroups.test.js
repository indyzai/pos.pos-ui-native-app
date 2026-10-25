import { expect, test } from 'bun:test';
import {
  operationListRows,
  operationDate,
  isDraftOperation,
} from '../../../../vendor/pos-ui-shared/packages-native/feature-organization/src/operations/operationList';
const row = (id, payload) => ({ id, payload: { id, ...payload }, updatedAt: 0 });
test('scrap purchases use purchase dates descending and group months across years', () => {
  const records = [
    row('old', { purchaseDate: '2025-10-25', createdAt: '2027-01-01' }),
    row('early', { purchaseDate: '2026-10-02' }),
    row('sep', { purchaseDate: '2026-09-10' }),
    row('latest', { purchaseDate: '2026-10-25' }),
  ];
  const list = operationListRows(records, 'scrapPurchases', 25, 'UTC');
  expect(list.filter((item) => item.kind === 'month').map((item) => item.title)).toEqual([
    'October 2026',
    'September 2026',
    'October 2025',
  ]);
  expect(list.filter((item) => item.kind === 'record').map((item) => item.row.id)).toEqual([
    'latest',
    'early',
    'sep',
    'old',
  ]);
  expect(records[0].id).toBe('old');
});
test('scrap sales use sale dates and paginate records before inserting month headings', () => {
  const records = [
    row('old', { saleDate: '2026-08-01', createdAt: '2027-01-01' }),
    row('late', { saleDate: '2026-09-30T20:00:00Z' }),
    row('earlier', { saleDate: '2026-09-10' }),
  ];
  const list = operationListRows(records, 'scrapSales', 2, 'Asia/Kolkata');
  expect(list.filter((item) => item.kind === 'month').map((item) => item.title)).toEqual([
    'October 2026',
    'September 2026',
  ]);
  expect(list.filter((item) => item.kind === 'record').map((item) => item.row.id)).toEqual([
    'late',
    'earlier',
  ]);
});
test('offline dates fall back to valid creation dates and missing dates stay last', () => {
  expect(operationDate({ id: '1', purchaseDate: 'bad', createdAt: '2026-10-25' }, 'scrapPurchases')).toBe(
    '2026-10-25',
  );
  const list = operationListRows(
    [row('unknown', {}), row('offline', { createdAt: '2026-10-25' })],
    'scrapSales',
    25,
    'UTC',
  );
  expect(list.filter((item) => item.kind === 'month').map((item) => item.title)).toEqual([
    'October 2026',
    'Unknown date',
  ]);
  expect(operationListRows([], 'scrapSales', 25)).toEqual([]);
});
test('draft styling applies only to drafts and non-scrap lists remain ungrouped', () => {
  expect(isDraftOperation({ id: '1', status: 'draft' })).toBe(true);
  expect(isDraftOperation({ id: '2', status: 'PENDING' })).toBe(false);
  expect(isDraftOperation({ id: '3', status: 'COMPLETED' })).toBe(false);
  expect(operationListRows([row('bank', {})], 'accounts', 25).map((item) => item.kind)).toEqual(['record']);
});
