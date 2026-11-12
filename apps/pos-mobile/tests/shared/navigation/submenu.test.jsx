globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';

let size = { width: 390, height: 844 };
let centerItem;
let backHandler;
const platform = { OS: 'android' };
mock.module('react-native', () => ({
  Platform: platform,
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Animated: { View: 'AnimatedView' },
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  useWindowDimensions: () => size,
  BackHandler: {
    addEventListener: (_event, callback) => {
      if (platform.OS !== 'android') throw new Error('BackHandler is Android-only');
      backHandler = callback;
      return {
        remove: () => {
          backHandler = null;
        },
      };
    },
  },
}));
mock.module('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 34, left: 0, right: 0 }),
}));
mock.module('lucide-react-native', () =>
  Object.fromEntries(['CircleOff', 'Menu', 'X', 'ChevronDown', 'Check'].map((name) => [name, () => null])),
);
const shared = '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src';
mock.module(`${shared}/theme/ThemeProvider`, () => ({
  useAppTheme: () => ({
    themeColors: {
      surface: '#fff',
      primary: '#126',
      primarySoft: '#def',
      text: '#111',
      textSecondary: '#555',
      outlineMuted: '#ddd',
    },
  }),
}));
mock.module(`${shared}/navigation/BottomNavigationProvider`, () => ({
  useBottomNavigation: () => ({ centerItem }),
}));
mock.module(`${shared}/navigation/useMenuMotion`, () => ({ useMenuMotion: () => ({}) }));
mock.module(`${shared}/i18n`, () => ({ translateUI: (text) => text }));
const { BottomNavigation } = await import(`${shared}/navigation/BottomNavigation`);
const { TabletNavigationPane } = await import(`${shared}/navigation/TabletNavigationPane`);
const Icon = () => null;
const leaf = (label, href) => ({ label, href, icon: Icon });
const items = [
  {
    ...leaf('Operations', '/orders'),
    children: [
      leaf('Orders', '/orders'),
      {
        ...leaf('Scrap', '/scrap'),
        children: [leaf('Scrap inventory', '/scrap'), leaf('Scrap sales', '/scrap-sales')],
      },
    ],
  },
];
const button = (view, label) =>
  view.root.findAllByType('Pressable').find((item) => item.props.accessibilityLabel === label);

test('More exposes nested destinations and keeps the current route action usable above the menu', async () => {
  const calls = [];
  centerItem = { label: 'New purchase', icon: Icon, badge: 3, onPress: () => calls.push('purchase') };
  let view;
  const render = () => (
    <BottomNavigation
      primaryItems={[]}
      moreItems={items}
      isActive={(href) => href === '/scrap-sales'}
      onNavigate={(href) => calls.push(href)}
    />
  );
  await act(async () => {
    view = create(render());
  });
  await act(async () => button(view, 'More').props.onPress());
  expect(button(view, 'Operations').props.accessibilityState.expanded).toBe(true);
  expect(button(view, 'Scrap').props.accessibilityState.expanded).toBe(true);
  expect(button(view, 'Scrap sales').props.accessibilityState.selected).toBe(true);
  expect(view.root.findAllByType('Modal')).toHaveLength(0);
  expect(button(view, 'New purchase').props.disabled).toBe(false);
  await act(async () => button(view, 'New purchase').props.onPress());
  expect(calls).toEqual(['purchase']);
  expect(button(view, 'More').props.accessibilityState.expanded).toBe(false);

  centerItem = { label: 'Refresh', icon: Icon, onPress: () => calls.push('refresh') };
  await act(async () => view.update(render()));
  expect(button(view, 'New purchase')).toBeUndefined();
  await act(async () => button(view, 'More').props.onPress());
  await act(async () => button(view, 'Refresh').props.onPress());
  expect(calls).toEqual(['purchase', 'refresh']);
  await act(async () => button(view, 'More').props.onPress());
  await act(async () => button(view, 'Scrap sales').props.onPress());
  expect(calls.at(-1)).toBe('/scrap-sales');
  expect(button(view, 'More').props.accessibilityState.expanded).toBe(false);
  await act(async () => view.unmount());
});

test('routes without an action hide the unused center button and Android back dismisses the menu', async () => {
  centerItem = null;
  let view;
  await act(async () => {
    view = create(
      <BottomNavigation primaryItems={[]} moreItems={items} isActive={() => false} onNavigate={() => {}} />,
    );
  });
  expect(
    view.root.findAll((node) => node.props.accessibilityLabel === 'Center action unavailable'),
  ).toHaveLength(0);
  await act(async () => button(view, 'More').props.onPress());
  expect(typeof backHandler).toBe('function');
  await act(async () => {
    expect(backHandler()).toBe(true);
  });
  expect(button(view, 'More').props.accessibilityState.expanded).toBe(false);
  await act(async () => view.unmount());
});

test('tablet groups expand without navigating and collapsed flyouts open the selected child directly', async () => {
  size = { width: 1024, height: 768 };
  const navigated = [];
  let view;
  const render = (collapsed) => (
    <TabletNavigationPane
      collapsed={collapsed}
      items={items}
      isActive={(href) => href === '/scrap-sales'}
      onNavigate={(href) => navigated.push(href)}
    />
  );
  await act(async () => {
    view = create(render(false));
  });
  expect(button(view, 'Scrap sales').props.accessibilityState.selected).toBe(true);
  await act(async () => button(view, 'Operations').props.onPress());
  expect(button(view, 'Operations').props.accessibilityState.expanded).toBe(false);
  expect(navigated).toEqual([]);
  await act(async () => view.update(render(true)));
  await act(async () => button(view, 'Operations').props.onPress());
  expect(view.root.findByType('Modal').props.visible).toBe(true);
  await act(async () => button(view, 'Scrap sales').props.onPress());
  expect(navigated).toEqual(['/scrap-sales']);
  expect(view.root.findByType('Modal').props.visible).toBe(false);
  await act(async () => view.unmount());
  size = { width: 390, height: 844 };
});

test('web and iOS open and dismiss More without registering an Android back handler', async () => {
  for (const os of ['web', 'ios']) {
    platform.OS = os;
    centerItem = null;
    let view;
    try {
      await act(async () => {
        view = create(
          <BottomNavigation
            primaryItems={[]}
            moreItems={items}
            isActive={() => false}
            onNavigate={() => {}}
          />,
        );
      });
      await act(async () => button(view, 'More').props.onPress());
      expect(button(view, 'More').props.accessibilityState.expanded).toBe(true);
      expect(backHandler).toBeNull();
      const close = view.root
        .findAllByType('Pressable')
        .find((item) => item.props.accessibilityLabel === 'Close more menu');
      await act(async () => close.props.onPress());
      expect(button(view, 'More').props.accessibilityState.expanded).toBe(false);
    } finally {
      if (view) await act(async () => view.unmount());
      platform.OS = 'android';
    }
  }
});
