import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const shared = '../../../../../vendor/pos-ui-shared/packages-native/sync-native/src';
let listener;
const database = {
  collection: () => ({
    subscribe: (fn) => {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
  }),
};
let local = { database, status: 'ready' };
const reads = [];
mock.module('react-native', () => ({ Text: 'Text' }));
mock.module('@indyzai/pos-ui-native', () => ({
  AppFormDialog: 'AppFormDialog',
  AppFormField: 'AppFormField',
  SyncNotificationButton: 'SyncNotificationButton',
  useAppTheme: () => ({ themeColors: {} }),
}));
mock.module('@indyzai/pos-database', () => ({ useLocalDatabase: () => local }));
mock.module(`${shared}/SyncJobTree`, () => ({ SyncJobTree: () => null }));
mock.module(`${shared}/nativeRuntime`, () => ({ getActiveNativeSyncRuntime: () => undefined }));
mock.module(`${shared}/corrections`, () => ({
  listNativeSyncJobs: (database) =>
    new Promise((resolve, reject) => reads.push({ database, resolve, reject })),
  correctNativeJobFields: async () => {},
  nativeCorrectionInput: () => ({}),
}));
const { FailedJobCorrections } = await import(`${shared}/FailedJobCorrections`);
const failed = (id) => ({ id, status: 'failed', dependencies: [], error: { code: 'VALIDATION_FAILED' } });
test('top-bar notification coalesces refreshes, excludes normal waits and isolates database changes', async () => {
  let view;
  await act(async () => {
    view = create(<FailedJobCorrections />);
  });
  expect(view.root.findAllByType('SyncNotificationButton')).toHaveLength(1);
  expect(view.root.findAllByType('AppFormDialog')).toHaveLength(0);
  expect(view.root.findByType('SyncNotificationButton').props.loading).toBe(true);
  // The initial read becomes obsolete while another queue notification is pending.
  await act(async () => {
    listener();
    reads[0].resolve([failed('stale')]);
  });
  expect(reads).toHaveLength(2);
  expect(view.root.findByType('SyncNotificationButton').props.loading).toBe(true);
  await act(async () => {
    reads[1].resolve([{ id: 'waiting', status: 'pending', blockedReason: 'parent: pending' }]);
  });
  expect(view.root.findByType('SyncNotificationButton').props.failedCount).toBe(0);
  await act(async () => {
    listener();
  });
  await act(async () => {
    reads[2].resolve([
      failed('a'),
      { ...failed('b'), status: 'conflict' },
      { ...failed('cancelled'), error: { code: 'CANCELLED' } },
    ]);
  });
  expect(view.root.findByType('SyncNotificationButton').props.failedCount).toBe(2);
  await act(async () => {
    listener();
  });
  const nextDatabase = { ...database };
  local = { database: nextDatabase, status: 'ready' };
  await act(async () => {
    view.update(<FailedJobCorrections />);
  });
  expect(view.root.findByType('SyncNotificationButton').props.failedCount).toBe(0);
  expect(view.root.findByType('SyncNotificationButton').props.loading).toBe(true);
  await act(async () => {
    reads[3].resolve([failed('old-owner')]);
    reads[4].resolve([failed('new-owner')]);
  });
  expect(view.root.findByType('SyncNotificationButton').props.failedCount).toBe(1);
  await act(async () => view.root.findByType('SyncNotificationButton').props.onPress());
  expect(view.root.findAllByType('AppFormDialog')).toHaveLength(1);
  await act(async () => view.unmount());
});
