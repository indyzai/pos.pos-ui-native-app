import { expect, test } from "bun:test";
import {
    PrinterService,
    labelPositions,
    type PrinterProfile,
    type PrinterRoutingRule,
} from "../src";

const profile: PrinterProfile = {
    id: "p1",
    organizationId: "org1",
    branchId: "b1",
    name: "Counter",
    type: "RECEIPT",
    connection: "TCP",
    driver: "escpos",
    enabled: true,
    paperWidth: 80,
    dpi: 203,
    charactersPerLine: 48,
    copies: 2,
    autoCut: true,
    cashDrawer: false,
};
const rule: PrinterRoutingRule = {
    id: "r1",
    organizationId: "org1",
    branchId: "b1",
    printerId: "p1",
    priority: 1,
    enabled: true,
};
const context = {
    organizationId: "org1",
    branchId: "b1",
    type: "RECEIPT" as const,
};

test("routing isolates organizations and branches", () => {
    const service = new PrinterService();
    expect(service.route(context, [profile], [rule])).toBe(profile);
    expect(() =>
        service.route(
            { ...context, organizationId: "other" },
            [profile],
            [rule],
        ),
    ).toThrow();
    expect(() =>
        service.route(context, [{ ...profile, branchId: "b2" }], [rule]),
    ).toThrow();
});

test("printing honors copies, rejects unavailable drivers, and propagates failures", async () => {
    const service = new PrinterService();
    const template = {
        id: "receipt",
        render: () => ({ content: "Receipt", contentType: "text" as const }),
    };
    await expect(
        service.print(context, [profile], [rule], template, {}),
    ).rejects.toThrow("unavailable");
    let printed = 0;
    service.register({
        id: "escpos",
        connections: ["TCP"],
        print: async (p) => {
            expect(p.copies).toBe(1);
            printed++;
        },
    });
    await service.print(context, [profile], [rule], template, {});
    expect(printed).toBe(2);
    const failing = new PrinterService();
    failing.register({
        id: "escpos",
        connections: ["TCP"],
        print: async () => {
            throw new Error("Disconnected");
        },
    });
    await expect(
        failing.print(context, [profile], [rule], template, {}),
    ).rejects.toThrow("Disconnected");
});

test("four one-inch labels fit a four-inch roll with no gaps; oversized layouts fail", () => {
    const layout = {
        paperWidth: 101.6,
        labelWidth: 25.4,
        labelHeight: 25.4,
        columns: 4,
        rows: 2,
        gap: 0,
        margin: 0,
    };
    const positions = labelPositions(layout);
    expect(positions.length).toBe(8);
    expect(positions[4]).toEqual({ x: 0, y: 25.4 });
    expect(() => labelPositions({ ...layout, gap: 2 })).toThrow("do not fit");
    expect(() => labelPositions({ ...layout, labelHeight: NaN })).toThrow();
});
