import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const exports = [];
mock.module('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
}));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
mock.module('lucide-react-native', () =>
  Object.fromEntries(['CheckCircle2', 'Printer', 'FileDown', 'X'].map((name) => [name, () => null])),
);
mock.module('@indyzai/pos-ui-native', () => ({
  AppPressable: 'AppPressable',
  AppFormDialog: 'AppFormDialog',
  AppDropdown: 'AppDropdown',
  PrintDocumentPreview: 'PrintDocumentPreview',
  useAppTheme: () => ({ themeColors: {} }),
}));
mock.module('@indyzai/pos-ui-native/snackbar', () => ({ showSnackbar: () => {} }));
mock.module('../../../../../vendor/pos-ui-shared/packages-native/feature-billing/src/receiptPdf', () => ({
  exportReceiptPdf: async (receipt, options) => {
    exports.push({ receipt, options });
    return 'shared';
  },
}));
const { ReceiptDialog } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-billing/src/native/ReceiptDialog'
);
const receipt = {
  id: 'INV-1',
  businessName: 'Shop',
  branchName: 'Main',
  counterName: 'One',
  createdAt: '2026-10-25',
  items: [],
  totals: { subtotal: 0, discount: 0, tax: 0, rounding: 0, total: 0 },
  payment: { method: 'CASH' },
};
test('order details open a thermal preview before sharing and export the selected paper width', async () => {
  let view;
  await act(async () => {
    view = create(<ReceiptDialog receipt={receipt} onClose={() => {}} />);
  });
  expect(view.root.findAllByType('PrintDocumentPreview')).toHaveLength(0);
  const action = view.root
    .findAllByType('AppPressable')
    .find((node) => node.props.accessibilityLabel === 'Preview and share thermal receipt PDF');
  await act(async () => action.props.onPress());
  expect(view.root.findByType('PrintDocumentPreview').props.document.lines).toContain('Receipt INV-1');
  await act(async () => view.root.findByType('AppDropdown').props.onChange('58'));
  expect(view.root.findByType('PrintDocumentPreview').props.options.paperWidthMm).toBe(58);
  await act(async () => view.root.findByType('AppFormDialog').props.onSubmit());
  expect(exports[0].options.paperWidthMm).toBe(58);
  await act(async () => view.unmount());
});
