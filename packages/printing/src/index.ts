export interface PrintDocument {
    title?: string;
    content: string;
    contentType: "text" | "html";
}

export interface Printer {
    print(document: PrintDocument): Promise<void>;
}

export type PrintType = "RECEIPT" | "LABEL" | "KITCHEN" | "REPORT" | "RETURN";
export type PrinterConnection =
    | "BLUETOOTH"
    | "USB"
    | "TCP"
    | "WIFI"
    | "ANDROID_NATIVE"
    | "VENDOR_SDK"
    | "SYSTEM";

export interface PrinterProfile {
    id: string;
    organizationId: string;
    branchId: string;
    name: string;
    type: PrintType;
    connection: PrinterConnection;
    driver: string;
    enabled: boolean;
    paperWidth: number;
    dpi: number;
    charactersPerLine: number;
    copies: number;
    autoCut: boolean;
    cashDrawer: boolean;
    codePage?: string;
    ipAddress?: string;
    port?: number;
    bluetoothAddress?: string;
    usbVendorId?: number;
    usbProductId?: number;
}

export interface PrintContext {
    organizationId: string;
    branchId: string;
    type: PrintType;
    counterId?: string;
    categoryId?: string;
    productId?: string;
    kitchenStationId?: string;
}

export interface PrinterRoutingRule extends Partial<
    Omit<PrintContext, "organizationId" | "branchId">
> {
    id: string;
    organizationId: string;
    branchId: string;
    printerId: string;
    priority: number;
    enabled: boolean;
}

export interface PrinterDriver {
    id: string;
    connections: readonly PrinterConnection[];
    print(profile: PrinterProfile, document: PrintDocument): Promise<void>;
    discover?(): Promise<readonly Partial<PrinterProfile>[]>;
}

export interface PrintTemplate<T> {
    id: string;
    render(data: T, profile: PrinterProfile): PrintDocument;
}

/** Hardware bindings are registered by the native app, never imported by this package. */
export class PrinterService {
    private readonly drivers = new Map<string, PrinterDriver>();

    register(driver: PrinterDriver): void {
        if (this.drivers.has(driver.id))
            throw new Error(`Printer driver already registered: ${driver.id}`);
        this.drivers.set(driver.id, driver);
    }

    route(
        context: PrintContext,
        profiles: readonly PrinterProfile[],
        rules: readonly PrinterRoutingRule[],
    ): PrinterProfile {
        const matches = rules
            .filter(
                (rule) =>
                    rule.enabled &&
                    rule.organizationId === context.organizationId &&
                    rule.branchId === context.branchId &&
                    (
                        [
                            "type",
                            "counterId",
                            "categoryId",
                            "productId",
                            "kitchenStationId",
                        ] as const
                    ).every((key) => !rule[key] || rule[key] === context[key]),
            )
            .sort(
                (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
            );
        for (const rule of matches) {
            const profile = profiles.find(
                (p) =>
                    p.id === rule.printerId &&
                    p.enabled &&
                    p.organizationId === context.organizationId &&
                    p.branchId === context.branchId &&
                    (p.type === context.type ||
                        (context.type === "RETURN" && p.type === "RECEIPT")),
            );
            if (profile) return profile;
        }
        throw new Error(
            "No enabled printer is routed for this branch and document.",
        );
    }

    async print<T>(
        context: PrintContext,
        profiles: readonly PrinterProfile[],
        rules: readonly PrinterRoutingRule[],
        template: PrintTemplate<T>,
        data: T,
    ): Promise<void> {
        const profile = this.route(context, profiles, rules);
        if (
            !Number.isInteger(profile.copies) ||
            profile.copies < 1 ||
            profile.copies > 20 ||
            !Number.isFinite(profile.paperWidth) ||
            profile.paperWidth <= 0 ||
            !Number.isFinite(profile.dpi) ||
            profile.dpi <= 0
        )
            throw new Error("Invalid printer profile.");
        const driver = this.drivers.get(profile.driver);
        if (!driver || !driver.connections.includes(profile.connection))
            throw new Error(`Printer driver unavailable: ${profile.driver}`);
        // The service owns copy counts. Drivers receive a single-copy profile.
        const singleCopy = { ...profile, copies: 1 };
        const document = template.render(data, profile);
        for (let copy = 0; copy < profile.copies; copy++)
            await driver.print(singleCopy, document);
    }
}

export interface LabelLayout {
    paperWidth: number;
    labelWidth: number;
    labelHeight: number;
    columns: number;
    rows: number;
    gap: number;
    margin: number;
}

/** Dimensions are millimetres; positions can be consumed by any label driver. */
export function labelPositions(
    layout: LabelLayout,
): Array<{ x: number; y: number }> {
    if (
        Object.values(layout).some((value) => !Number.isFinite(value)) ||
        layout.paperWidth <= 0 ||
        layout.labelWidth <= 0 ||
        layout.labelHeight <= 0 ||
        layout.gap < 0 ||
        layout.margin < 0 ||
        !Number.isInteger(layout.columns) ||
        !Number.isInteger(layout.rows) ||
        layout.columns < 1 ||
        layout.rows < 1 ||
        layout.columns * layout.rows > 10000
    )
        throw new Error("Invalid label dimensions.");
    const required =
        layout.margin * 2 +
        layout.columns * layout.labelWidth +
        (layout.columns - 1) * layout.gap;
    if (required > layout.paperWidth + 0.001)
        throw new Error("Labels do not fit the configured paper width.");
    return Array.from({ length: layout.columns * layout.rows }, (_, index) => ({
        x:
            layout.margin +
            (index % layout.columns) * (layout.labelWidth + layout.gap),
        y:
            layout.margin +
            Math.floor(index / layout.columns) *
                (layout.labelHeight + layout.gap),
    }));
}
export * from "./nativeCommands";
