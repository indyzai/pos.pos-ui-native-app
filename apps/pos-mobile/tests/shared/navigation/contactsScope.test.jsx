import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const vendors = [
  { payload: { id: 'v1', type: 'SCRAP_VENDOR', name: 'Scrap seller' } },
  { payload: { id: 'c1', type: 'CUSTOMER', name: 'Customer' } },
];
const empty = [];
const database = {};
const colors = { text: '#111', textSecondary: '#555', surface: '#fff', primary: '#123', outline: '#ddd' };
const setCenterItem = () => {};
mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
}));
mock.module('lucide-react-native', () =>
  Object.fromEntries(
    ['Plus', 'Pencil', 'RefreshCw', 'Search', 'UserRound'].map((name) => [name, () => null]),
  ),
);
mock.module('@indyzai/pos-ui-native', () => ({
  AppPressable: 'AppPressable',
  AppFormDialog: 'AppFormDialog',
  AppFormField: 'AppFormField',
  showSnackbar: () => {},
  useAppTheme: () => ({ themeColors: colors }),
  useBottomNavigation: () => ({ setCenterItem }),
}));
mock.module('@indyzai/pos-database', () => ({
  createOfflineTableHook:
    ({ table }) =>
    () => ({ data: table === 'customers' ? vendors : empty, loading: false }),
  payloadsFromRecords: (rows) => rows.map((row) => row.payload),
  useLocalDatabase: () => ({ database }),
}));
mock.module(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-customers/src/ContactAccountDialog',
  () => ({ ContactAccountDialog: () => null }),
);
const { CustomersScreen } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-customers/src/CustomersScreen'
);
test('scrap vendor entry point restricts contact data and hides the single contact-type tab', async () => {
  let view;
  await act(async () => {
    view = create(<CustomersScreen api={{}} onlyType="SCRAP_VENDOR" />);
  });
  expect(view.root.findByType('FlatList').props.data.map((row) => row.name)).toEqual(['Scrap seller']);
  expect(view.root.findAllByType('ScrollView')).toHaveLength(0);
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'Scrap vendors')).toBe(true);
  await act(async () => view.unmount());
});
test('the general Contacts entry point retains all contact-type tabs', async () => {
  let view;
  await act(async () => {
    view = create(<CustomersScreen api={{}} />);
  });
  expect(view.root.findAllByType('ScrollView')).toHaveLength(1);
  expect(view.root.findByType('FlatList').props.data.map((row) => row.name)).toEqual(['Customer']);
  await act(async () => view.unmount());
});
