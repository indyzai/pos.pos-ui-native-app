import { expect, test } from 'bun:test';
import { formatCurrency } from '../../src/shared/utils/currency';

test('formats configured currencies without assuming rupees', () => {
  expect(formatCurrency(12.5, 'USD')).toContain('$');
  expect(formatCurrency(12.5, 'EUR')).toMatch(/€|EUR/);
  expect(formatCurrency(12.5, 'INR')).toMatch(/₹|INR/);
});

test('supports compact whole-value formatting', () => {
  expect(formatCurrency(42, 'USD', 0)).not.toContain('.00');
});
