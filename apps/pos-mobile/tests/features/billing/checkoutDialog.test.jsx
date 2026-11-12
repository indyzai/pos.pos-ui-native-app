import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Modal: 'Modal',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  ScrollView: 'ScrollView',
  Platform: { OS: 'web' },
  StyleSheet: { create: (value) => value, hairlineWidth: 1, absoluteFill: {} },
}));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
mock.module('lucide-react-native', () => ({
  ArrowLeft: 'Icon',
  Banknote: 'Icon',
  CreditCard: 'Icon',
  ScanLine: 'Icon',
  X: 'Icon',
}));
mock.module('react-native-qrcode-svg', () => ({ default: 'QRCode' }));
mock.module('@indyzai/pos-ui-native', () => ({
  AppPressable: 'AppPressable',
  useAppTheme: () => ({ themeColors: {} }),
}));
mock.module('@indyzai/pos-ui-native/i18n', () => ({ translateUI: (value) => value }));
mock.module('@indyzai/pos-ui-native/currency', () => ({
  formatCurrency: (value) => `INR ${value.toFixed(2)}`,
}));
const { CheckoutDialog } = await import('@indyzai/feature-billing/native/CheckoutDialog');
const accounts = [
  { id: 1, accountName: 'Front', isActive: true, isDefault: true, upiId: 'front@upi' },
  { id: 2, accountName: 'Back', isActive: true, isDefault: false, upiId: 'back@upi' },
];
const methods = [
  { id: 'cash', code: 'CASH', name: 'Cash', isActive: true, bankAccounts: [] },
  { id: 'upi', code: 'UPI', name: 'UPI', isActive: true, bankAccounts: accounts },
];
const base = {
  visible: true,
  initialMethod: 'UPI',
  total: 100,
  itemCount: 1,
  paymentMethods: methods,
  submitting: false,
  onClose: () => {},
  onConfirm: () => {},
};
const text = (node) =>
  node.children.map((child) => (typeof child === 'string' ? child : text(child))).join('');
const complete = (view) =>
  view.root.findAllByType('AppPressable').find((node) => text(node).startsWith('Complete'));
test('UPI checkout requires confirmation again after changing amount or receiving account', async () => {
  let view, payment;
  await act(async () => {
    view = create(
      <CheckoutDialog
        {...base}
        onConfirm={(value) => {
          payment = value;
        }}
      />,
    );
  });
  expect(complete(view).props.disabled).toBe(true);
  await act(async () => view.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  expect(complete(view).props.disabled).toBe(false);
  await act(async () => complete(view).props.onPress());
  expect(payment).toMatchObject({ method: 'UPI', bankAccountId: 1, paymentConfirmed: true });
  await act(async () =>
    view.root
      .findAllByType('AppPressable')
      .find((node) => text(node).includes('Back'))
      .props.onPress(),
  );
  expect(complete(view).props.disabled).toBe(true);
  await act(async () => view.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  await act(async () => view.update(<CheckoutDialog {...base} total={120} />));
  expect(complete(view).props.disabled).toBe(true);
  await act(async () => view.unmount());
});
test('cash edits survive catalog refresh and checkout offers customer, hold and configured tender shortcuts', async () => {
  let view,
    selected = 0,
    held = 0;
  const props = {
    ...base,
    initialMethod: 'CASH',
    denominations: [{ value: 200 }],
    onSelectCustomer: () => selected++,
    onHold: () => held++,
  };
  await act(async () => {
    view = create(<CheckoutDialog {...props} />);
  });
  await act(async () =>
    view.root.findByProps({ accessibilityLabel: 'Cash received' }).props.onChangeText('150'),
  );
  await act(async () => view.update(<CheckoutDialog {...props} paymentMethods={[...methods]} />));
  expect(view.root.findByProps({ accessibilityLabel: 'Cash received' }).props.value).toBe('150');
  await act(async () =>
    view.root.findByProps({ accessibilityLabel: 'Select checkout customer' }).props.onPress(),
  );
  await act(async () =>
    view.root
      .findAllByType('AppPressable')
      .find((node) => text(node) === 'Hold transaction')
      .props.onPress(),
  );
  expect(selected).toBe(1);
  expect(held).toBe(1);
  await act(async () =>
    view.root
      .findAllByType('AppPressable')
      .find((node) => text(node) === 'INR 200.00')
      .props.onPress(),
  );
  expect(view.root.findByProps({ accessibilityLabel: 'Cash received' }).props.value).toBe('200.00');
  await act(async () => view.unmount());
});
