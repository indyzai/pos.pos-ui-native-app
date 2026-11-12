import { expect, test } from 'bun:test';
import {
  pullCursors,
  groupPullCursors,
  formatPullDate,
} from '../../../../../vendor/pos-ui-shared/packages-native/feature-organization/src/pullCursors';
const row = (id, payload, updatedAt = Date.parse('2026-11-12T12:00:00Z')) => ({ id, payload, updatedAt });
test('pull dates come from applied markers, not a newer remote tree or local row edit', () => {
  const rows = pullCursors(
    [],
    [
      row('tree', {
        tree: {
          nodes: [{ key: 'pos.products', resourceKey: 'products', updatedAt: '2026-11-12T12:00:00Z' }],
        },
      }),
      row('marker', {
        nodeKey: 'pos.products',
        partitionKey: '-',
        appliedRevision: '10',
        serverUpdatedAt: '2026-11-10T10:00:00Z',
        pulledAt: '2026-11-11T10:00:00Z',
      }),
    ],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    label: 'products',
    serverUpdatedAt: '2026-11-10T10:00:00Z',
    pulledAt: '2026-11-11T10:00:00Z',
    legacy: false,
  });
});
test('modern markers replace stale legacy collection entries', () => {
  expect(
    pullCursors(
      [row('old', { collection: 'payment_methods', lastSyncedAt: 1000 })],
      [
        row('new', {
          nodeKey: 'pos.payments',
          resourceKey: 'paymentMethods',
          appliedRevision: '4',
          partitionKey: '-',
        }),
      ],
    ),
  ).toHaveLength(1);
});
test('a legacy entry without a successful pull does not display its storage update as a pull date', () => {
  expect(pullCursors([row('old', { collection: 'products' })], [])[0].pulledAt).toBeUndefined();
  expect(formatPullDate(undefined)).toBe('Not recorded');
});
test('older checkpoints retain their server date without inventing a download date', () => {
  const item = pullCursors(
    [],
    [
      row('new', {
        nodeKey: 'products',
        appliedRevision: '4',
        partitionKey: '2026-11',
        serverUpdatedAt: '2026-11-10T10:00:00Z',
      }),
    ],
  )[0];
  expect(item.label).toBe('products · 2026-11');
  expect(item.pulledAt).toBeUndefined();
});
test('invalid timestamps are honest and valid dates use the configured timezone', () => {
  expect(formatPullDate('bad-date')).toBe('Unknown');
  const input = '2026-11-12T23:00:00Z';
  expect(formatPullDate(input, 'Asia/Kolkata')).toContain('13');
  expect(formatPullDate(String(Date.parse(input)), 'UTC')).toBe(formatPullDate(input, 'UTC'));
  expect(formatPullDate(input, 'invalid-zone')).not.toBe('Unknown');
});

test('widgets are grouped by their data dates rather than server/download timestamps', () => {
  const cursors = pullCursors(
    [],
    [
      row('a', {
        nodeKey: 'pos.dashboard.widget.a',
        resourceKey: 'widget:a',
        partitionKey: '2026-11-10',
        appliedRevision: '1',
        serverUpdatedAt: '2026-11-12T10:00:00Z',
      }),
      row('b', {
        nodeKey: 'pos.dashboard.widget.b',
        resourceKey: 'widget:b',
        partitionKey: '2026-11-10',
        appliedRevision: '2',
        serverUpdatedAt: '2026-11-11T10:00:00Z',
      }),
      row('c', {
        nodeKey: 'pos.dashboard.widget.c',
        resourceKey: 'widget:c',
        partitionKey: '2026-11-11',
        appliedRevision: '3',
      }),
      row('products', {
        nodeKey: 'pos.products',
        resourceKey: 'products',
        partitionKey: '-',
        appliedRevision: '1',
      }),
    ],
  );
  const groups = groupPullCursors(cursors);
  expect(groups.collections.map((item) => item.resource)).toEqual(['products']);
  expect(groups.widgets.map((group) => [group.date, group.rows.length])).toEqual([
    ['2026-11-11', 1],
    ['2026-11-10', 2],
  ]);
  expect(groups.widgets[1].rows[0].serverUpdatedAt).toBe('2026-11-12T10:00:00Z');
});
test('widgets without a date remain separate and named widget nodes are recognized from the tree', () => {
  const cursors = pullCursors(
    [],
    [
      row('tree', {
        tree: { nodes: [{ key: 'custom.widget', type: 'widget', resourceKey: 'salesTotals' }] },
      }),
      row('marker', { nodeKey: 'custom.widget', partitionKey: '-', appliedRevision: '1' }),
    ],
  );
  expect(groupPullCursors(cursors).widgets[0]).toMatchObject({
    date: 'No date',
    rows: [{ resource: 'salesTotals' }],
  });
  expect(groupPullCursors([])).toEqual({ collections: [], widgets: [] });
});

test('archived widget checkpoints are excluded from active date groups', () => {
  const cursors = pullCursors(
    [],
    [
      {
        ...row('old', {
          nodeKey: 'pos.dashboard.widget.1',
          appliedRevision: '1',
          partitionKey: '2026-01-01',
          widgetArchivedAt: 123,
        }),
        deletedAt: 123,
      },
      row('active', { nodeKey: 'pos.dashboard.widget.1', appliedRevision: '2', partitionKey: '2026-11-12' }),
    ],
  );
  expect(groupPullCursors(cursors).widgets.map((group) => group.date)).toEqual(['2026-11-12']);
});
