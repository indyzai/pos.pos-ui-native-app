import { expect, test } from 'bun:test';
import {
  getBillingBootstrapCollections,
  resolveBillingMode,
} from '../../../src/features/billing/domain/billingMode';

test('resolves supported business-specific billing behavior', () => {
  expect(resolveBillingMode('pharmacy')).toMatchObject({ mode: 'pharmacy', scanByDefault: true });
  expect(resolveBillingMode('restaurant')).toMatchObject({
    mode: 'restaurant',
    scanByDefault: false,
    showQuickPicks: false,
  });
  expect(resolveBillingMode('WHOLESALE').searchPlaceholder).toContain('bulk');
  expect(resolveBillingMode('supermarket').mode).toBe('retail');
});

test('falls back safely to retail billing', () => {
  expect(resolveBillingMode(undefined).mode).toBe('retail');
  expect(resolveBillingMode('unsupported').mode).toBe('retail');
});

test('resolves required bootstrap collections per business mode', () => {
  expect(getBillingBootstrapCollections('retail')).toEqual([
    'products',
    'customers',
    'paymentMethods',
    'taxRates',
    'counterSessions',
  ]);
  expect(getBillingBootstrapCollections('pharmacy')).toContain('productBatches');
  expect(getBillingBootstrapCollections('service')).toContain('serviceUsers');
  expect(getBillingBootstrapCollections('restaurant')).toContain('tables');
});
