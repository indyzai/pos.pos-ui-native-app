import { expect, test } from 'bun:test';
import { pharmacyProductStatus } from '../../../src/features/billing/domain/pharmacyProduct';

const product = (expiryDate) => ({
  id: 'medicine-1',
  name: 'Medicine',
  category: 'General',
  price: 10,
  stock: 5,
  emoji: '💊',
  color: '#fff',
  details: expiryDate ? { expiryDate } : undefined,
});

test('identifies expired and soon-to-expire pharmacy stock', () => {
  const now = new Date('2026-09-11T00:00:00.000Z');
  expect(pharmacyProductStatus(product('2026-09-10'), now)).toMatchObject({ expired: true });
  expect(pharmacyProductStatus(product('2026-10-01'), now)).toMatchObject({
    expired: false,
    expiringSoon: true,
  });
  expect(pharmacyProductStatus(product('2027-01-01'), now)).toMatchObject({
    expired: false,
    expiringSoon: false,
  });
});

test('treats missing or malformed expiry metadata as unknown, not expired', () => {
  const now = new Date('2026-09-11T00:00:00.000Z');
  expect(pharmacyProductStatus(product(undefined), now)).toEqual({ expired: false, expiringSoon: false });
  expect(pharmacyProductStatus(product('not-a-date'), now)).toEqual({ expired: false, expiringSoon: false });
});
