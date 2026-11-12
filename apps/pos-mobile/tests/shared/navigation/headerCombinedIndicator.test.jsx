import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const shared = '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src';
mock.module('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 390 }),
  StyleSheet: { create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1 },
}));
mock.module('lucide-react-native', () =>
  Object.fromEntries(
    [
      'Building2',
      'ChevronLeft',
      'ChevronRight',
      'LockKeyhole',
      'LogOut',
      'Menu',
      'Moon',
      'RefreshCw',
      'Repeat2',
      'Settings',
      'Store',
      'Sun',
      'UserRound',
      'UnlockKeyhole',
      'Wifi',
      'WifiOff',
      'X',
    ].map((name) => [name, name]),
  ),
);
mock.module('@indyzai/pos-ui-native/i18n', () => ({ translateUI: (value) => value }));
mock.module(`${shared}/AppPressable`, () => ({ AppPressable: 'AppPressable' }));
mock.module(`${shared}/branding/PosLogo`, () => ({ AdminLogo: 'AdminLogo', PosLogo: 'PosLogo' }));
mock.module(`${shared}/theme/ThemeProvider`, () => ({
  useAppTheme: () => ({
    isDark: false,
    mode: 'light',
    setMode: () => {},
    themeColors: new Proxy({}, { get: () => '#123456' }),
  }),
}));
const { AppHeader } = await import(`${shared}/layout/AppHeader`);
test('a combined sync control replaces the separate online control in the header', async () => {
  let view,
    opened = 0;
  const props = {
    branchName: 'Main',
    counterName: 'Front',
    isCounterOpen: true,
    userInitials: 'AB',
    userName: 'User',
    userRole: 'Cashier',
    isOnline: true,
    pendingQueueCount: 2,
    storage: { status: 'ready', retry: () => {} },
    onCounterPress: () => {},
    onPendingSyncPress: () => opened++,
    onProfile: () => {},
    onDebugUser: () => {},
    onSwitchBusiness: () => {},
    onSettings: () => {},
    onLogout: () => {},
  };
  await act(async () => {
    view = create(<AppHeader {...props} syncNotification={React.createElement('CombinedSyncIndicator')} />);
  });
  expect(view.root.findAllByType('CombinedSyncIndicator')).toHaveLength(1);
  expect(view.root.findAllByType('Wifi')).toHaveLength(0);
  expect(
    view.root
      .findAllByType('AppPressable')
      .some((node) => node.props.accessibilityLabel?.includes('mutations pending')),
  ).toBe(false);
  // Existing callers without a custom combined control keep their storage action.
  await act(async () => view.update(<AppHeader {...props} />));
  expect(view.root.findAllByType('Wifi')).toHaveLength(1);
  const status = view.root
    .findAllByType('AppPressable')
    .find((node) => node.props.accessibilityLabel?.includes('mutations pending'));
  await act(async () => status.props.onPress());
  expect(opened).toBe(1);
  await act(async () => view.unmount());
});
