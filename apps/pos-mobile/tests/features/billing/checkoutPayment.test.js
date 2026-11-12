import { expect, test } from 'bun:test';
import {
  activePaymentAccounts,
  defaultPaymentAccount,
  cashShortcuts,
  checkoutPayment,
  checkoutPaymentError,
} from '@indyzai/feature-billing/domain/checkoutPayment';
import { createPendingSale } from '@indyzai/feature-billing/salesOutbox';
const method = (code, bankAccounts = []) => ({
  id: code,
  name: code,
  code,
  isActive: true,
  isQuickAccess: true,
  isBankRelated: code !== 'CASH',
  bankAccountIds: bankAccounts.map((row) => row.id),
  bankAccounts,
});
const draft = (code, overrides = {}) => ({
  method: method(code),
  total: 100,
  cash: '100',
  cardLast4: '',
  reference: '',
  upiConfirmed: false,
  ...overrides,
});
test('cash validates finite amounts, short payments and change', () => {
  for (const cash of ['', '99', '-1', 'Infinity', 'bad'])
    expect(checkoutPaymentError(draft('CASH', { cash }))).toContain('cash');
  expect(
    checkoutPayment(draft('CASH', { cash: '150', bankAccountId: 9, reference: 'stale card ref' })),
  ).toEqual({ method: 'CASH', tenderedAmount: 150, changeDue: 50 });
  expect(checkoutPaymentError(draft('CASH', { cash: '0', total: 0 }))).toBeUndefined();
});
test('UPI requires receipt confirmation even when a reference is present', () => {
  expect(checkoutPaymentError(draft('UPI', { reference: 'UTR' }))).toContain('Confirm');
  expect(checkoutPayment(draft('UPI', { upiConfirmed: true, reference: ' UTR ' }))).toMatchObject({
    method: 'UPI',
    paymentConfirmed: true,
    referenceNumber: 'UTR',
  });
  expect(checkoutPaymentError(draft('UPI', { total: 0 }))).toBeUndefined();
});
test('card accepts four digits or blank and combines authorization with last four', () => {
  expect(checkoutPaymentError(draft('CREDIT_CARD', { cardLast4: '12' }))).toContain('four');
  expect(checkoutPayment(draft('CREDIT_CARD', { cardLast4: '1234', reference: 'AUTH' }))).toMatchObject({
    cardLast4: '1234',
    referenceNumber: 'CARD-1234 · AUTH',
  });
  expect(checkoutPaymentError(draft('CARD'))).toBeUndefined();
});
test('account defaults and payloads exclude inactive receiving accounts', () => {
  const accounts = [
    { id: 1, isDefault: true, isActive: false },
    { id: 2, isDefault: false, isActive: true },
  ];
  const configured = { ...method('UPI', accounts), defaultBankAccountId: 1 };
  expect(activePaymentAccounts(configured)).toHaveLength(1);
  expect(defaultPaymentAccount(configured).id).toBe(2);
  expect(
    checkoutPaymentError(draft('UPI', { method: configured, upiConfirmed: true, bankAccountId: 1 })),
  ).toContain('active receiving account');
  expect(
    checkoutPayment(draft('UPI', { method: configured, upiConfirmed: true, bankAccountId: 2 })).bankAccountId,
  ).toBe(2);
});
test('unknown or disabled methods and invalid totals cannot be confirmed', () => {
  expect(checkoutPaymentError(draft('UPI', { method: undefined }))).toContain('available');
  expect(checkoutPaymentError(draft('UPI', { method: { ...method('UPI'), isActive: false } }))).toContain(
    'available',
  );
  expect(checkoutPaymentError(draft('CASH', { total: NaN }))).toContain('total');
});
test('cash suggestions use only configured values that cover the total', () => {
  expect(
    cashShortcuts(150, [{ value: 100 }, { value: 200 }, { value: 500 }, { value: 200 }, { value: NaN }]),
  ).toEqual([200, 500]);
  expect(cashShortcuts(150)).toEqual([]);
});
test('payment confirmation and card details survive the queued sale payload', () => {
  const sale = createPendingSale({
    items: [{ id: '12', name: 'Tea', price: 100, quantity: 1, taxRate: 0, discount: 0 }],
    payment: checkoutPayment(draft('CARD', { cardLast4: '1234', reference: 'AUTH' })),
    session: null,
    requireOpenSession: false,
  });
  expect(sale.input.details.cardLast4).toBe('1234');
  expect(sale.input.payments[0].referenceNumber).toBe('CARD-1234 · AUTH');
  const upi = createPendingSale({
    items: [{ id: '12', name: 'Tea', price: 100, quantity: 1, taxRate: 0, discount: 0 }],
    payment: checkoutPayment(draft('UPI', { upiConfirmed: true })),
    session: null,
    requireOpenSession: false,
  });
  expect(upi.input.details.paymentConfirmed).toBe(true);
});
