import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles) => styles },
}));
mock.module('@indyzai/pos-ui-native', () => ({
  AppPressable: 'AppPressable',
  useAppTheme: () => ({
    themeColors: {
      text: '#fff',
      textSecondary: '#aaa',
      surfaceMuted: '#222',
      primary: '#88f',
      success: '#8f8',
      error: '#f88',
      outline: '#555',
      outlineMuted: '#333',
    },
  }),
}));
const { SyncJobTree } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/sync-native/src/SyncJobTree'
);
const job = (id, sequence, dependencies, status = 'pending') => ({
  id,
  sequence,
  dependencies,
  status,
  attempts: 1,
  maxAttempts: 3,
  entity: { table: id === 'product' ? 'products' : 'sales', id },
  input: { source: 'table', payload: { operation: 'CREATE' } },
  error: status === 'failed' ? { code: 'VALIDATION_FAILED', message: 'Correct name' } : undefined,
});
const button = (view, text) =>
  view.root
    .findAllByType('AppPressable')
    .find((node) => node.findAllByType('Text').some((child) => child.props.children === text));
test('native job tree expands and collapses branches and preserves retry/correction actions', async () => {
  const jobs = [
    job('sale', 3, ['product'], 'failed'),
    job('product', 1, [], 'failed'),
    job('other-sale', 2, ['product']),
  ];
  const edited = [],
    retried = [];
  let view;
  await act(async () => {
    view = create(
      <SyncJobTree
        jobs={jobs}
        onEdit={(job) => edited.push(job.id)}
        onRetry={(job) => retried.push(job.id)}
      />,
    );
  });
  expect(view.root.findAllByProps({ testID: 'sync-job-product' })).toHaveLength(2);
  await act(async () => button(view, 'Retry unchanged').props.onPress());
  expect(retried).toEqual(['sale']);
  await act(async () => button(view, 'Edit and retry').props.onPress());
  expect(edited).toEqual(['sale']);
  await act(async () => button(view, 'Collapse all').props.onPress());
  expect(view.root.findAllByProps({ testID: 'sync-job-product' })).toHaveLength(0);
  const expand = view.root
    .findAllByType('AppPressable')
    .find((node) => node.props.accessibilityLabel?.startsWith('Expand '));
  await act(async () => expand.props.onPress());
  expect(view.root.findAllByProps({ testID: 'sync-job-product' })).toHaveLength(1);
  await act(async () => button(view, 'Expand all').props.onPress());
  expect(view.root.findAllByProps({ testID: 'sync-job-product' })).toHaveLength(2);
  await act(async () => view.unmount());
});
