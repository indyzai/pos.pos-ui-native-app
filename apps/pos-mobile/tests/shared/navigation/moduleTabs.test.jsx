globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
import React from 'react';
mock.module('react-native', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { hairlineWidth: 1 },
}));
mock.module('../../../../../vendor/pos-ui-shared/packages-native/ui-native/src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    themeColors: { surface: '#fff', text: '#111', primary: '#123', textSecondary: '#555', outline: '#ddd' },
  }),
}));
const { ModuleTabs } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src/navigation/ModuleTabs'
);
const Icon = () => null;
const item = { label: 'Waybills', icon: Icon, href: '/waybills' };
test('module navigation hides the complete tab section when zero or one tab is available', async () => {
  for (const items of [[], [item]]) {
    let view;
    await act(async () => {
      view = create(
        <ModuleTabs title="Logistics" items={items} isActive={() => true} onNavigate={() => {}} />,
      );
    });
    expect(view.toJSON()).toBeNull();
    await act(async () => view.unmount());
  }
});
test('multiple tabs remain visible and selecting a different tab navigates to its page', async () => {
  let view;
  const navigated = [];
  await act(async () => {
    view = create(
      <ModuleTabs
        title="Logistics"
        items={[item, { ...item, label: 'Shipping bills', href: '/shipping-bills' }]}
        isActive={(href) => href === '/waybills'}
        onNavigate={(href) => navigated.push(href)}
      />,
    );
  });
  const tabs = view.root.findAllByType('Pressable');
  expect(tabs).toHaveLength(2);
  expect(tabs[0].props.accessibilityState.selected).toBe(true);
  await act(async () => tabs[1].props.onPress());
  expect(navigated).toEqual(['/shipping-bills']);
  await act(async () => view.unmount());
});
