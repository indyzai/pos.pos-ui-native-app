import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const database = {};
function checkChildren(children) {
  for (const child of React.Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number')
      throw new Error(`Raw text outside Text: ${JSON.stringify(child)}`);
  }
}
function View({ children, ...props }) {
  checkChildren(children);
  return <view {...props}>{children}</view>;
}
function Form({ children }) {
  checkChildren(children);
  return <View>{children}</View>;
}
mock.module('react-native', () => ({ Text: 'Text', View }));
mock.module('@indyzai/pos-database', () => ({ getActiveDatabase: () => database }));
mock.module('@indyzai/pos-ui-native', () => ({
  AppFormDialog: Form,
  PrintDocumentPreview: 'PrintDocumentPreview',
  AppDropdown: () => null,
  AppFormField: () => null,
  AppPressable: View,
  useAppTheme: () => ({ themeColors: {} }),
  showSnackbar: () => {},
}));
mock.module(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/nativeDelivery',
  () => ({ sendNativePrint: async () => {} }),
);
mock.module('../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/configuration', () => ({
  nativeConfig: () => ({}),
}));
const { LabelPrintDialog } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/LabelPrintDialog'
);
test('label dialog never passes empty error or barcode strings directly to native containers', async () => {
  for (const barcode of [undefined, '', '123456']) {
    let view;
    await act(async () => {
      view = create(
        <LabelPrintDialog
          document={{ kind: 'barcode', title: 'Product', lines: ['Product label'], barcode }}
          loadPrinters={async () => []}
          onClose={() => {}}
        />,
      );
    });
    expect(view.toJSON()).not.toBeNull();
    await act(async () => view.unmount());
  }
});
test('printer loading errors are rendered inside Text', async () => {
  let view;
  await act(async () => {
    view = create(
      <LabelPrintDialog
        document={{ kind: 'barcode', title: 'Product', lines: [] }}
        loadPrinters={async () => {
          throw new Error('Printer unavailable');
        }}
        onClose={() => {}}
      />,
    );
  });
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'Printer unavailable')).toBe(
    true,
  );
  await act(async () => view.unmount());
});
