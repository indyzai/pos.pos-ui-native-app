import { expect, test } from "bun:test";
import {
    resolveFeatureFlag,
    resolveFeatureToggles,
    isRouteFeatureEnabled,
    businessTypeProfiles,
} from "../src";

test("global disable wins over organization booleans and records", () => {
    const flags = resolveFeatureToggles({
        features: { "scrap.enabled": true },
        globalFeatures: { "scrap.enabled": false },
        featureFlags: [
            {
                feature_code: "scrap.enabled",
                global_enabled: true,
                organization_enabled: true,
            },
        ],
    });
    expect(flags.scrap).toBe(false);
    expect(isRouteFeatureEnabled("/scrap/intake", flags)).toBe(false);
    expect(isRouteFeatureEnabled("/settings", flags)).toBe(true);
});

test("scheduled availability is bounded and business-scoped", () => {
    const record = {
        feature_code: "pharmacy.enabled",
        global_enabled: true,
        organization_enabled: true,
        business_type: "PHARMACY",
        effective_from: "2026-01-01",
        effective_to: "2026-02-01",
    };
    expect(
        resolveFeatureFlag(record, "pharmacy", Date.parse("2026-01-01")),
    ).toBe(true);
    expect(resolveFeatureFlag(record, "retail", Date.parse("2026-01-02"))).toBe(
        false,
    );
    expect(
        resolveFeatureFlag(record, "pharmacy", Date.parse("2026-02-01")),
    ).toBe(false);
    expect(
        resolveFeatureFlag({ ...record, effective_to: "bad-date" }, "pharmacy"),
    ).toBe(false);
});

test("all requested business profiles exist and unknown profiles accept explicit configuration", () => {
    for (const type of [
        "RETAIL",
        "RESTAURANT",
        "PHARMACY",
        "WHOLESALE",
        "ELECTRONICS",
        "SERVICE",
        "GROCERY",
        "HARDWARE",
        "JEWELLERY",
        "CLOTHING",
        "AUTO_PARTS",
        "GENERAL_TRADING",
        "OTHER",
        "CUSTOM",
    ]) {
        expect(businessTypeProfiles[type]).toBeDefined();
    }
    expect(
        resolveFeatureToggles({
            businessType: "REPAIR_SHOP",
            features: { "services.enabled": true },
        }).serviceOrders,
    ).toBe(true);
});
