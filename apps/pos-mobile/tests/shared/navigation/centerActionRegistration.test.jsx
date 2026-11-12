import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test } from 'bun:test';
import {
  BottomNavigationProvider,
  useBottomNavigation,
} from '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src/navigation/BottomNavigationProvider';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const Icon = () => null;
let current;
function Observer() {
  current = useBottomNavigation().centerItem;
  return null;
}
function Action({ label, onPress = () => {} }) {
  const { setCenterItem } = useBottomNavigation();
  useEffect(() => {
    setCenterItem(label ? { label, icon: Icon, onPress } : null);
    return () => setCenterItem(null);
  }, [label, setCenterItem]);
  return null;
}
test('an empty parent registration cannot erase its child route action', async () => {
  function Parent() {
    const { setCenterItem } = useBottomNavigation();
    useEffect(() => {
      setCenterItem(null);
      return () => setCenterItem(null);
    }, [setCenterItem]);
    return <Action label="Add printer" />;
  }
  let view;
  await act(async () => {
    view = create(
      <BottomNavigationProvider>
        <Parent />
        <Observer />
      </BottomNavigationProvider>,
    );
  });
  expect(current?.label).toBe('Add printer');
  await act(async () => view.unmount());
});
test('cleaning up an inactive component does not disable the active center action', async () => {
  const screen = (first) => (
    <BottomNavigationProvider>
      {first && <Action key="first" label="Save" />}
      <Action key="second" label="Sync" />
      <Observer />
    </BottomNavigationProvider>
  );
  let view;
  await act(async () => {
    view = create(screen(true));
  });
  expect(current?.label).toBe('Sync');
  await act(async () => view.update(screen(false)));
  expect(current?.label).toBe('Sync');
  await act(async () => view.unmount());
});
test('removing an override restores the underlying action and the latest handler', async () => {
  const calls = [];
  const screen = (label, child) => (
    <BottomNavigationProvider>
      <Action key="parent" label={label} onPress={() => calls.push(label)} />
      {child && <Action key="child" label="Save draft" />}
      <Observer />
    </BottomNavigationProvider>
  );
  let view;
  await act(async () => {
    view = create(screen('New count', true));
  });
  expect(current?.label).toBe('Save draft');
  await act(async () => view.update(screen('New count', false)));
  expect(current?.label).toBe('New count');
  await act(async () => view.update(screen('Refresh', false)));
  current.onPress();
  expect(calls).toEqual(['Refresh']);
  await act(async () => view.unmount());
});
