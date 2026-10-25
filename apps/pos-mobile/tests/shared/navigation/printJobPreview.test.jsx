import React from 'react';
import { act, create } from 'react-test-renderer';
import { test, expect, mock } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
mock.module('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View' }));
mock.module('@indyzai/pos-ui-native', () => ({
  AppFormDialog: 'AppFormDialog',
  AppPressable: 'AppPressable',
  PrintDocumentPreview: 'PrintDocumentPreview',
  useAppTheme: () => ({ themeColors: {} }),
}));
const { PrintJobDetailsDialog } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/feature-printers/src/PrintJobDetailsDialog'
);
test('print-job details open on the document preview rather than hiding it after metadata', async () => {
  const document = { kind: 'receipt', title: 'Shop', lines: ['Receipt INV-1'] };
  let view;
  await act(async () => {
    view = create(
      <PrintJobDetailsDialog
        job={{ id: '42', invoiceNumber: 'INV-1' }}
        branchName="Main"
        counterName="Front"
        loadPreview={async () => ({ document, source: 'Saved document' })}
        onClose={() => {}}
      />,
    );
  });
  expect(view.root.findByType('PrintDocumentPreview').props.document).toEqual(document);
  const tabs = view.root
    .findAllByType('AppPressable')
    .filter((node) => node.props.accessibilityRole === 'tab');
  expect(tabs[0].props.accessibilityState.selected).toBe(true);
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'Job ID')).toBe(false);
  await act(async () => tabs[1].props.onPress());
  expect(view.root.findAllByType('Text').some((node) => node.props.children === 'Job ID')).toBe(true);
  await act(async () => view.unmount());
});
