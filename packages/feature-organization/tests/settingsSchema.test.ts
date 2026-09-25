import { expect, test } from "bun:test";
import { settingsFields, validateSettingsPatch } from "../src/settingsSchema";
import { hasEntitlement } from "@indyzai/pos-permissions";

test("every settings section has fields and keys are unique", () => {
    expect(new Set(settingsFields.map((field) => field.section)).size).toBe(9);
    expect(new Set(settingsFields.map((field) => field.key)).size).toBe(
        settingsFields.length,
    );
});
test("normalizes a partial settings edit without adding untouched defaults", () => {
    expect(
        validateSettingsPatch({
            businessName: "  Corner store  ",
            defaultTaxRate: "18",
            roundOffTotal: false,
        }),
    ).toEqual({
        businessName: "Corner store",
        defaultTaxRate: 18,
        roundOffTotal: false,
    });
});
test("rejects invalid numeric values and required fields", () => {
    for (const value of ["-1", "101", "NaN", ""])
        expect(() =>
            validateSettingsPatch({ defaultTaxRate: value }),
        ).toThrow();
    expect(() => validateSettingsPatch({ businessName: " " })).toThrow(
        "required",
    );
    expect(() =>
        validateSettingsPatch({ autoRefreshIntervalSeconds: 1 }),
    ).toThrow();
});
test("validates email, timezone, color and secure integration URLs", () => {
    expect(() => validateSettingsPatch({ email: "invalid" })).toThrow();
    expect(() => validateSettingsPatch({ timezone: "invalid-zone" })).toThrow();
    expect(() => validateSettingsPatch({ primaryColor: "red" })).toThrow();
    expect(() =>
        validateSettingsPatch({ apiEndpoint: "http://example.com" }),
    ).toThrow();
    expect(() =>
        validateSettingsPatch({
            apiEndpoint: "https://user:secret@example.com",
        }),
    ).toThrow();
    expect(
        validateSettingsPatch({
            timezone: "Asia/Kolkata",
            apiEndpoint: "https://example.com/api",
            primaryColor: "#aabbcc",
        }).primaryColor,
    ).toBe("#aabbcc");
});
test("does not accept credentials or arbitrary policy objects in the settings outbox", () => {
    expect(() => validateSettingsPatch({ apiKey: "secret" })).toThrow(
        "Unsupported",
    );
    expect(() => validateSettingsPatch({ unknownFlag: true })).toThrow(
        "Unsupported",
    );
    expect(() => validateSettingsPatch({ theme: "unknown" })).toThrow();
});
test("POS stays manager-capped and cannot write organization settings", () => {
    expect(hasEntitlement("organization.manage", "owner", "owner", "pos")).toBe(
        false,
    );
    expect(
        hasEntitlement("organization.manage", "owner", "owner", "admin"),
    ).toBe(true);
    expect(
        hasEntitlement("organization.manage", "cashier", "cashier", "pos"),
    ).toBe(false);
});
