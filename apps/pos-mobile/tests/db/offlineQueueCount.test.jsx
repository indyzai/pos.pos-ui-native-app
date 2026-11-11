import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let records = [{ id: 'job', payload: { status: 'pending' } }];
let notify;
const database = {
  canonicalJobs: true,
  collection: () => ({
    list: async () => records,
    subscribe: (fn) => {
      notify = fn;
      return () => {};
    },
  }),
  transaction: async (_tables, work) => work(database),
};
let local = { database, status: 'ready' };
const shared = '../../../../vendor/pos-ui-shared/packages-native/database/src';
mock.module(`${shared}/react`, () => ({ useLocalDatabase: () => local }));
const { useOfflineQueueCount } = await import(`${shared}/offlineQueueHook`);
test('pending-to-running transitions keep one atomic header count and never leak another database snapshot', async () => {
  let count, view;
  const seen = [];
  function Header() {
    count = useOfflineQueueCount();
    seen.push(count);
    return null;
  }
  await act(async () => {
    view = create(<Header />);
  });
  expect(count).toBe(1);
  seen.length = 0;
  records = [{ id: 'job', payload: { status: 'running' } }];
  await act(async () => {
    notify();
    notify();
    notify();
  });
  expect(count).toBe(1);
  expect(seen.every((value) => value === 1)).toBe(true);
  records = [
    { id: 'job', payload: { status: 'synced' } },
    { id: 'failed', payload: { status: 'failed' } },
  ];
  await act(async () => {
    notify();
  });
  expect(count).toBe(0);
  local = { database: null, status: 'initializing' };
  await act(async () => {
    view.update(<Header />);
  });
  expect(count).toBe(0);
  await act(async () => view.unmount());
});
