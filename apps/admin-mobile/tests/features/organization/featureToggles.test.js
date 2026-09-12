import { describe, expect, test } from 'bun:test';
import { resolveFeatureToggles } from '../../../src/features/organization/featureToggles.js';

describe('organization feature toggles', () => {
    test('applies business defaults and nested server overrides', () => {
        const flags = resolveFeatureToggles({
            businessType: 'PHARMACY',
            features: { prescriptions: false, scrap: false, customFeature: true },
        });
        expect(flags.batchExpiry).toBe(true);
        expect(flags.prescriptions).toBe(false);
        expect(flags.scrap).toBe(false);
        expect(flags.customFeature).toBe(true);
    });

    test('supports legacy billing keys without exposing duplicate counter flags', () => {
        const flags = resolveFeatureToggles({
            allowItemDiscounts: true,
            features: { requireCounterSessionForBilling: false },
        });
        expect(flags.allowItemDiscounts).toBe(true);
        expect(flags.requireOpenCounterForBilling).toBe(false);
        expect(flags.requireCounterSessionForBilling).toBeUndefined();
    });
});
