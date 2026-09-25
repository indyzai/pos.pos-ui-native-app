export type PrinterLanguage = "ESC_POS" | "TSPL" | "ZPL";
export type NativePrinterConfig = {
    language: PrinterLanguage;
    widthMm: number;
    heightMm: number;
    gapMm: number;
    dpi: number;
    copies: number;
    autoCut: boolean;
    model?: string;
    usbVendorId?: number;
    usbProductId?: number;
    usbInterfaceId?: number;
    usbEndpointAddress?: number;
    usbDeviceName?: string;
    bluetoothServiceUuid?: string;
    bluetoothCharacteristicUuid?: string;
    clientPrinterId?: string;
};
export type NativePrintDocument = {
    kind: "receipt" | "barcode" | "shipping";
    title: string;
    lines: string[];
    barcode?: string;
};
export const cd410Profile: NativePrinterConfig = {
    model: "CD410-UB",
    language: "TSPL",
    widthMm: 100,
    heightMm: 150,
    gapMm: 2,
    dpi: 203,
    copies: 1,
    autoCut: false,
};

export function validatePrinterConfig(config: NativePrinterConfig) {
    if (!["ESC_POS", "TSPL", "ZPL"].includes(config.language))
        throw new Error(
            "Select ESC/POS, TSPL or ZPL supported by this printer.",
        );
    for (const [key, min, max] of [
        ["widthMm", 20, 110],
        ["heightMm", 15, 500],
        ["gapMm", 0, 20],
        ["dpi", 203, 600],
        ["copies", 1, 20],
    ] as const) {
        const value = config[key];
        if (!Number.isFinite(value) || value < min || value > max)
            throw new Error(`${key} must be between ${min} and ${max}.`);
    }
    if (
        ![203, 300, 600].includes(config.dpi) ||
        !Number.isInteger(config.copies)
    )
        throw new Error("Use a supported DPI and a whole copy count.");
    if (
        config.model === "CD410-UB" &&
        (config.widthMm > 108 || config.dpi !== 203)
    )
        throw new Error(
            "CD410-UB uses 203 DPI and a maximum print width of 108 mm.",
        );
}
function ascii(value: string) {
    if (/[^\x20-\x7e\n]/.test(value))
        throw new Error(
            "This raw printer profile supports printable ASCII text. Non-Latin receipts need a raster/vendor font driver.",
        );
    return value;
}
function wrap(lines: string[], columns: number): string[] {
    return lines.flatMap((line) =>
        ascii(line)
            .split("\n")
            .flatMap((part) => {
                const rows: string[] = [];
                do {
                    rows.push(part.slice(0, columns));
                    part = part.slice(columns);
                } while (part.length);
                return rows;
            }),
    );
}
const tsplText = (value: string) => ascii(value).replace(/["\\]/g, " ");
const zplText = (value: string) =>
    Array.from(
        ascii(value),
        (char) => `_${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
    ).join("");
const bytes = (value: string) =>
    Uint8Array.from(value, (char) => char.charCodeAt(0));

/** Raw protocols are generated only from validated structured data, never user-supplied commands. */
export function renderNativeDocument(
    document: NativePrintDocument,
    config: NativePrinterConfig,
): Uint8Array {
    validatePrinterConfig(config);
    if (
        document.title.length +
            document.lines.reduce((total, line) => total + line.length, 0) >
        32_000
    )
        throw new Error("Print document exceeds the 32,000 character limit.");
    if (document.lines.length > 300)
        throw new Error("Print document has too many lines.");
    if (config.language === "ESC_POS") {
        if (document.kind !== "receipt")
            throw new Error(
                "Choose TSPL or ZPL for barcode and shipping labels.",
            );
        const columns = Math.floor((config.widthMm * config.dpi) / 25.4 / 12);
        const text = wrap([document.title, ...document.lines], columns).join(
            "\n",
        );
        return bytes(
            `\x1b@\x1bM\x00${text}\n\n\n${config.autoCut ? "\x1dV\x00" : ""}`,
        );
    }
    if (document.kind === "receipt")
        throw new Error(
            "Receipt printing requires an ESC/POS thermal profile.",
        );
    const dots = (mm: number) => Math.round((mm * config.dpi) / 25.4);
    const width = dots(config.widthMm),
        height = dots(config.heightMm),
        margin = dots(2),
        fontHeight = config.language === "TSPL" ? 12 : dots(3);
    // TSPL built-in font 1 is fixed 8 x 12 dots, independent of resolution.
    const fontWidth =
        config.language === "TSPL" ? 8 : Math.ceil(fontHeight * 0.6);
    const lines = wrap(
        [document.title, ...document.lines],
        Math.max(1, Math.floor((width - 2 * margin) / fontWidth)),
    );
    const barcode = document.barcode ? ascii(document.barcode) : undefined;
    if (document.kind === "barcode" && !barcode)
        throw new Error("Enter a barcode value.");
    if (
        barcode &&
        (!/^[A-Za-z0-9 ._/-]+$/.test(barcode) || barcode.length > 80)
    )
        throw new Error(
            "Use 1–80 letters, digits, spaces or ._/- in the barcode.",
        );
    const barcodeHeight = dots(10);
    const y = margin + lines.length * (fontHeight + 4);
    if (
        y + (barcode ? barcodeHeight + fontHeight + margin : 0) >
        height - margin
    )
        throw new Error(
            "Content does not fit this label. Increase label height or shorten the text.",
        );
    const narrow = barcode
        ? Math.min(
              2,
              Math.floor(
                  (width - 2 * margin) / (11 * (barcode.length + 3) + 2 + 20),
              ),
          )
        : 2;
    if (barcode && narrow < 1)
        throw new Error("Barcode is too long for the configured label width.");
    if (config.language === "TSPL")
        return bytes(
            [
                `SIZE ${config.widthMm} mm,${config.heightMm} mm`,
                `GAP ${config.gapMm} mm,0 mm`,
                "DIRECTION 1",
                "CLS",
                ...lines.map(
                    (line, index) =>
                        `TEXT ${margin},${margin + index * (fontHeight + 4)},"1",0,1,1,"${tsplText(line)}"`,
                ),
                ...(barcode
                    ? [
                          `BARCODE ${margin + 10 * narrow},${y},"128",${barcodeHeight},1,0,${narrow},${narrow},"${barcode}"`,
                      ]
                    : []),
                "PRINT 1,1",
                "",
            ].join("\r\n"),
        );
    return bytes(
        [
            "^XA",
            `^PW${width}`,
            `^LL${height}`,
            "^LH0,0",
            ...lines.map(
                (line, index) =>
                    `^FO${margin},${margin + index * (fontHeight + 4)}^A0N,${fontHeight},${Math.floor(fontHeight * 0.6)}^FH_^FD${zplText(line)}^FS`,
            ),
            ...(barcode
                ? [
                      `^FO${margin + 10 * narrow},${y}^BY${narrow}^BCN,${barcodeHeight},Y,N,N^FH_^FD${zplText(barcode)}^FS`,
                  ]
                : []),
            "^XZ",
            "",
        ].join("\r\n"),
    );
}
export function encodePrintBase64(data: Uint8Array): string {
    const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";
    for (let i = 0; i < data.length; i += 3) {
        const n =
            (data[i] << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
        output +=
            alphabet[(n >>> 18) & 63] +
            alphabet[(n >>> 12) & 63] +
            (i + 1 < data.length ? alphabet[(n >>> 6) & 63] : "=") +
            (i + 2 < data.length ? alphabet[n & 63] : "=");
    }
    return output;
}
