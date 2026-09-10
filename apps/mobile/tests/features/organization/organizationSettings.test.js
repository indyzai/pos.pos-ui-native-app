import { expect, test } from 'bun:test';
import { requiresOpenCounter } from '../../../src/features/organization/organizationApi';

test('billing requires an open counter by default', () => {
  expect(requiresOpenCounter(undefined)).toBe(true);
});

test('organization feature flag can allow billing without a counter session', () => {
  expect(requiresOpenCounter({ features: { requireOpenCounterForBilling: false } })).toBe(false);
});
