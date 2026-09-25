import { expect, test } from "bun:test";
import {
    cd410Profile,
    encodePrintBase64,
    renderNativeDocument,
    validatePrinterConfig,
} from "../src/nativeCommands";
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
test("CD410 TSPL prints one structured shipping label per transmission", () => {
    const result = text(
        renderNativeDocument(
            {
                kind: "shipping",
                title: "Shipping",
                lines: ["Recipient", "Address"],
                barcode: "TRACK123",
            },
            cd410Profile,
        ),
    );
    expect(result).toContain("SIZE 100 mm,150 mm");
    expect(result).toContain("GAP 2 mm,0 mm");
    expect(result).toContain('"128"');
    expect(result).toEndWith("PRINT 1,1\r\n");
});
test("ESC/POS wraps receipt content and only cuts when enabled", () => {
    const config = {
        ...cd410Profile,
        model: "Generic",
        language: "ESC_POS" as const,
        widthMm: 48,
    };
    const result = text(
        renderNativeDocument(
            { kind: "receipt", title: "Store", lines: ["x".repeat(80)] },
            config,
        ),
    );
    expect(result).toStartWith("\x1b@\x1bM\x00");
    expect(result).not.toContain("\x1dV");
    expect(
        text(
            renderNativeDocument(
                { kind: "receipt", title: "Store", lines: [] },
                { ...config, autoCut: true },
            ),
        ),
    ).toEndWith("\x1dV\x00");
});
test("label commands escape text and reject control characters or oversized content", () => {
    const result = text(
        renderNativeDocument(
            { kind: "shipping", title: "^XZ ~JA", lines: [] },
            { ...cd410Profile, language: "ZPL" },
        ),
    );
    expect(result).toContain("_5e_58_5a");
    expect(result.match(/\^XZ/g)).toHaveLength(1);
    expect(() =>
        renderNativeDocument(
            { kind: "shipping", title: "\x1b@", lines: [] },
            cd410Profile,
        ),
    ).toThrow("ASCII");
    expect(() =>
        renderNativeDocument(
            { kind: "shipping", title: "தமிழ்", lines: [] },
            cd410Profile,
        ),
    ).toThrow("ASCII");
    expect(() =>
        renderNativeDocument(
            {
                kind: "shipping",
                title: "Title",
                lines: Array(100).fill("line"),
            },
            cd410Profile,
        ),
    ).toThrow("fit");
    expect(() =>
        renderNativeDocument(
            { kind: "barcode", title: "Item", lines: [] },
            cd410Profile,
        ),
    ).toThrow("barcode value");
    expect(() =>
        renderNativeDocument(
            {
                kind: "barcode",
                title: "Item",
                lines: [],
                barcode: '"\r\nPRINT',
            },
            cd410Profile,
        ),
    ).toThrow();
});
test("device dimensions and base64 are deterministic", () => {
    expect(() => validatePrinterConfig({ ...cd410Profile, dpi: 300 })).toThrow(
        "203",
    );
    expect(() =>
        validatePrinterConfig({ ...cd410Profile, copies: 1.5 }),
    ).toThrow("whole");
    expect(() =>
        validatePrinterConfig({ ...cd410Profile, widthMm: NaN }),
    ).toThrow();
    for (const value of ["", "a", "ab", "abc", "abcd", "\x00\xff"]) {
        const bytes = Uint8Array.from(value, (c) => c.charCodeAt(0));
        expect(encodePrintBase64(bytes)).toBe(
            Buffer.from(bytes).toString("base64"),
        );
    }
});
