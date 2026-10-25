import { expect, test } from 'bun:test';
import { groupRecordsByMonth } from '../../../../vendor/pos-ui-shared/packages-native/feature-orders/src/monthGroups';
const dateOf = (row) => row.date;
test('orders sort newest first and group by month and year without changing the source', () => {
  const rows = [
    { id: 'old', date: '2025-10-20T00:00:00Z' },
    { id: 'oct1', date: '2026-10-01T00:00:00Z' },
    { id: 'sep', date: '2026-09-20T00:00:00Z' },
    { id: 'oct2', date: '2026-10-25T00:00:00Z' },
  ];
  const groups = groupRecordsByMonth(rows, dateOf, rows.length, 'UTC');
  expect(groups.map((group) => group.title)).toEqual(['October 2026', 'September 2026', 'October 2025']);
  expect(groups[0].items.map((row) => row.id)).toEqual(['oct2', 'oct1']);
  expect(rows[0].id).toBe('old');
  expect(groupRecordsByMonth(rows, dateOf, 1, 'UTC')[0].items[0].id).toBe('oct2');
});
test('month boundaries follow the business timezone and missing dates appear last', () => {
  const groups = groupRecordsByMonth(
    [{ date: '' }, { date: '2026-09-30T20:00:00Z' }, { date: '2026-09-01T00:00:00Z' }],
    dateOf,
    3,
    'Asia/Kolkata',
  );
  expect(groups.map((group) => group.title)).toEqual(['October 2026', 'September 2026', 'Unknown date']);
  expect(groupRecordsByMonth([], dateOf)).toEqual([]);
});
