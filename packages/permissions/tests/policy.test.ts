import { expect, test } from "bun:test";
import {
    resolvePermissions,
    canAccessStoreApp,
    canAccessAdminApp,
} from "../src";

test("POS admits higher roles with manager permissions while Admin remains restricted", () => {
    for (const role of ["cashier", "manager"]) {
        expect(canAccessStoreApp(role)).toBe(true);
        expect(canAccessAdminApp(role)).toBe(false);
    }
    for (const role of ["admin", "owner", "superadmin"]) {
        expect(canAccessStoreApp(role)).toBe(true);
        expect(canAccessAdminApp(role)).toBe(true);
        expect([...resolvePermissions(role)].sort()).toEqual(
            [...resolvePermissions("manager")].sort(),
        );
        const elevated = resolvePermissions(role, undefined, "pos", {
            user: { "pricing.edit": true, "purchases.edit": true },
        });
        expect(elevated.has("pricing.edit")).toBe(false);
        expect(elevated.has("purchases.edit")).toBe(false);
    }
    for (const role of ["", "guest", "member", "user", "unknown"]) {
        expect(resolvePermissions(role).size).toBe(0);
    }
});

test("higher-level denials cannot be re-enabled by user policy", () => {
    const result = resolvePermissions("manager", undefined, "pos", {
        global: { "payment.refund": false },
        organization: { "billing.discount": false, "payment.refund": true },
        user: {
            "billing.discount": true,
            "payment.refund": true,
            "organization.manage": true,
        },
    });
    expect(result.has("payment.refund")).toBe(false);
    expect(result.has("billing.discount")).toBe(false);
    expect(result.has("organization.manage")).toBe(false);
    expect(result.has("billing.create")).toBe(true);
});

test("organization policy can enable a cashier discount and user policy can revoke it", () => {
    expect(
        resolvePermissions("cashier", undefined, "pos", {
            organization: { "billing.discount": true },
        }).has("billing.discount"),
    ).toBe(true);
    expect(
        resolvePermissions("cashier", undefined, "pos", {
            organization: { "billing.discount": true },
            user: { "billing.discount": false },
        }).has("billing.discount"),
    ).toBe(false);
});
