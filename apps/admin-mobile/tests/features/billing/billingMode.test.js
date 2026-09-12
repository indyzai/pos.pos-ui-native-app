import { expect, test } from 'bun:test';
import { resolveBillingMode } from '../../../src/features/billing/domain/billingMode';

test('resolves supported business-specific billing behavior', () => {
    expect(resolveBillingMode('pharmacy')).toMatchObject({ mode: 'pharmacy', scanByDefault: true });
    expect(resolveBillingMode('restaurant')).toMatchObject({
        mode: 'restaurant',
        scanByDefault: false,
        showQuickPicks: false,
    });
    expect(resolveBillingMode('WHOLESALE').searchPlaceholder).toContain('bulk');
});

test('falls back safely to retail billing', () => {
    expect(resolveBillingMode(undefined).mode).toBe('retail');
    expect(resolveBillingMode('unsupported').mode).toBe('retail');
});
