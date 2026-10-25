import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const database = {};
const products = [
  { payload: { id: 'a', name: 'Item A', barcode: '12345', price: 10 } },
  { payload: { id: 'b', name: 'Item B', barcode: '67890', price: 20 } },
];
const profile = {
  language: 'TSPL',
  widthMm: 100,
  heightMm: 150,
  gapMm: 2,
  dpi: 203,
  copies: 1,
  autoCut: false,
};
const calls = [];
mock.module('react-native', () => ({ Text: 'Text', View: 'View' }));
mock.module('lucide-react-native', () => ({ Plus: () => null, Trash2: () => null }));
mock.module('@indyzai/pos-ui-native', () => ({
  AppFormDialog: 'AppFormDialog',
  AppDropdown: 'AppDropdown',
  AppFormField: 'AppFormField',
  AppPressable: 'AppPressable',
  PrintDocumentPreview: 'PrintDocumentPreview',
  showSnackbar: () => {},
  useAppTheme: () => ({ themeColors: {} }),
}));
mock.module('@indyzai/pos-database', () => ({
  getActiveDatabase: () => database,
  createOfflineTableHook: () => () => ({ data: products }),
}));
mock.module('@indyzai/pos-auth/session', () => ({
  useAuthSession: () => ({ session: { organization: { settings: { currency: 'INR' } } } }),
}));
mock.module(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/nativeDelivery',
  () => ({
    sendNativePrint: async (printer, document) => {
      calls.push({ copies: printer.config.native.copies, barcode: document.barcode });
    },
  }),
);
mock.module('../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/configuration', () => ({
  nativeConfig: (printer) => printer.config.native,
}));
const { BarcodePrintDialog } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/BarcodePrintDialog'
);
const loadPrinters = async () => [
  {
    id: 'p',
    name: 'Labels',
    isActive: true,
    type: 'barcode',
    printerTypes: ['barcode'],
    config: { native: profile },
  },
];
test('inventory barcode workflow adds multiple items, previews them and prints the chosen quantities', async () => {
  let view;
  let closed = 0;
  await act(async () => {
    view = create(
      <BarcodePrintDialog
        loadPrinters={loadPrinters}
        onClose={() => {
          closed++;
        }}
      />,
    );
  });
  for (const name of ['Item A', 'Item B']) {
    const button = view.root
      .findAllByType('AppPressable')
      .find((node) => node.props.accessibilityLabel === `Add ${name} for barcode printing`);
    await act(async () => button.props.onPress());
  }
  const quantities = view.root
    .findAllByType('AppFormField')
    .filter((node) => node.props.label === 'Label quantity');
  await act(async () => quantities[0].props.onChangeText('3'));
  await act(async () => view.root.findByType('AppFormDialog').props.onSubmit());
  expect(view.root.findAllByType('PrintDocumentPreview')).toHaveLength(2);
  await act(async () => view.root.findByType('AppFormDialog').props.onSubmit());
  expect(calls).toEqual([
    { copies: 3, barcode: '12345' },
    { copies: 1, barcode: '67890' },
  ]);
  expect(closed).toBe(1);
  await act(async () => view.unmount());
});
test('reconciliation opens directly in preview with the added label quantities', async () => {
  let view;
  await act(async () => {
    view = create(
      <BarcodePrintDialog
        loadPrinters={loadPrinters}
        initialItems={[{ product: products[0].payload, quantity: 7, addedQuantity: 7 }]}
        onClose={() => {}}
      />,
    );
  });
  expect(view.root.findAllByType('PrintDocumentPreview')).toHaveLength(1);
  expect(view.root.findByType('AppFormDialog').props.submitLabel).toBe('Print 7 labels');
  await act(async () => view.unmount());
});
