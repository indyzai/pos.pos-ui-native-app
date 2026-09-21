import { expect, test } from 'bun:test';
import { buildUpiPaymentUri } from '../../../src/features/billing/domain/upiPayment';

test('builds an encoded UPI payment URI from the configured account', () => {
  expect(
    buildUpiPaymentUri({ upiId: 'shop@upi', payeeName: 'Demo & Co', amount: 125.5, currencyCode: 'inr' }),
  ).toBe('upi://pay?pa=shop%40upi&pn=Demo+%26+Co&am=125.50&cu=INR');
});

test('does not create a QR payload without a valid configured payee', () => {
  expect(buildUpiPaymentUri({ upiId: '', amount: 100 })).toBeUndefined();
  expect(buildUpiPaymentUri({ upiId: 'invalid', amount: 100 })).toBeUndefined();
});
