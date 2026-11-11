import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const shared = '../../../../../vendor/pos-ui-shared/packages-native';
const colors = {
  surface: '#fff',
  surfaceMuted: '#eee',
  errorSoft: '#fee',
  error: '#b00',
  textSecondary: '#555',
  outlineMuted: '#ddd',
};
mock.module('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles) => styles },
}));
mock.module('lucide-react-native', () => ({ AlertCircle: 'AlertCircle', GitBranch: 'GitBranch' }));
mock.module(`${shared}/ui-native/src/theme/ThemeProvider`, () => ({
  useAppTheme: () => ({ themeColors: colors }),
}));
mock.module(`${shared}/ui-native/src/AppPressable`, () => ({ AppPressable: 'AppPressable' }));
const { SyncNotificationButton } = await import(`${shared}/ui-native/src/layout/SyncNotificationButton`);
test('sync notification keeps the same footprint through hydration, failures and recovery', async () => {
  let view,
    opened = 0;
  const render = (loading, failedCount) => (
    <SyncNotificationButton loading={loading} failedCount={failedCount} onPress={() => opened++} />
  );
  await act(async () => {
    view = create(render(true, 0));
  });
  const dimensions = view.root.findByType('AppPressable').props.style[0];
  expect(view.root.findAllByType('ActivityIndicator')).toHaveLength(1);
  await act(async () => {
    view.update(render(false, 3));
  });
  expect(view.root.findByType('AppPressable').props.style[0]).toEqual(dimensions);
  expect(view.root.findByType('AppPressable').props.accessibilityLabel).toContain(
    '3 sync jobs need attention',
  );
  expect(view.root.findAllByType('AlertCircle')).toHaveLength(1);
  await act(async () => view.root.findByType('AppPressable').props.onPress());
  expect(opened).toBe(1);
  await act(async () => {
    view.update(render(false, 0));
  });
  expect(view.root.findByType('AppPressable').props.style[0]).toEqual(dimensions);
  expect(view.root.findAllByType('AlertCircle')).toHaveLength(0);
  await act(async () => view.unmount());
});
