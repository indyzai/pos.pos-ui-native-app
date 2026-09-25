const baseDefaults = {
    inventory: true,
    customers: true,
    suppliers: true,
    finance: true,
    purchases: true,
    returns: true,
    shifts: true,
    scrap: true,
    stockTransfers: true,
    waybills: true,
    multiBranch: true,
    printers: true,
    advancedReporting: true,
    prescriptions: false,
    batchExpiry: false,
    tables: false,
    bulkPricing: false,
    serviceOrders: false,
    serialNumbers: false,
    enableBarcodeScanning: true,
    allowItemDiscounts: false,
    allowOrderDiscounts: false,
    requireOpenCounterForBilling: true,
} as const;

export type FeatureToggleKey = keyof typeof baseDefaults | string;
export type FeatureToggles = Record<string, boolean>;

export const businessTypeProfiles: Record<string, Partial<FeatureToggles>> = {
    RETAIL: {},
    GROCERY: {},
    HARDWARE: {},
    JEWELLERY: { serialNumbers: true },
    CLOTHING: {},
    AUTO_PARTS: {},
    GENERAL_TRADING: {},
    OTHER: {},
    CUSTOM: {},
    PHARMACY: { prescriptions: true, batchExpiry: true },
    RESTAURANT: { tables: true },
    WHOLESALE: { bulkPricing: true },
    SERVICE: { serviceOrders: true },
    ELECTRONICS: { serialNumbers: true, serviceOrders: true },
};

export const featureToggleLabels: Record<string, string> = {
    inventory: "Inventory",
    customers: "Customers",
    suppliers: "Suppliers",
    finance: "Finance",
    purchases: "Purchases",
    returns: "Returns and refunds",
    shifts: "Counter shifts",
    scrap: "Scrap exchange",
    stockTransfers: "Stock transfers",
    waybills: "Waybills",
    multiBranch: "Multiple branches",
    printers: "Printing",
    advancedReporting: "Session reporting",
    prescriptions: "Prescriptions",
    batchExpiry: "Batch and expiry tracking",
    tables: "Restaurant tables",
    bulkPricing: "Bulk pricing",
    serviceOrders: "Service orders",
    serialNumbers: "Serial numbers",
    enableBarcodeScanning: "Barcode scanning",
    allowItemDiscounts: "Item discounts",
    allowOrderDiscounts: "Order discounts",
    requireOpenCounterForBilling: "Require open counter",
};

export function resolveFeatureToggles(
    settings?: Record<string, unknown>,
    now = Date.now(),
): FeatureToggles {
    const businessType = String(
        settings?.businessType || "RETAIL",
    ).toUpperCase();
    const nested = isRecord(settings?.features) ? settings.features : {};
    const configured = Object.fromEntries(
        [...Object.entries(settings || {}), ...Object.entries(nested)]
            .filter(
                ([key, value]) =>
                    key !== "features" && typeof value === "boolean",
            )
            .map(([key, value]) => [featureKey(key), value]),
    ) as FeatureToggles;
    if (
        configured.requireOpenCounterForBilling === undefined &&
        typeof configured.requireCounterSessionForBilling === "boolean"
    ) {
        configured.requireOpenCounterForBilling =
            configured.requireCounterSessionForBilling;
    }
    delete configured.requireCounterSessionForBilling;
    const result: FeatureToggles = {
        ...baseDefaults,
        ...businessTypeProfiles[businessType],
        ...configured,
    };
    const global = isRecord(settings?.globalFeatures)
        ? settings.globalFeatures
        : {};
    const denied = new Set<string>();
    for (const [code, enabled] of Object.entries(global)) {
        if (enabled === false) denied.add(featureKey(code));
    }
    const records = Array.isArray(settings?.featureFlags)
        ? settings.featureFlags
        : [];
    for (const record of records) {
        if (!isFeatureFlag(record)) continue;
        const key = featureKey(record.feature_code);
        const globalDenied =
            global[record.feature_code] === false || global[key] === false;
        const enabled =
            !globalDenied && resolveFeatureFlag(record, businessType, now);
        result[key] = enabled;
        if (!enabled) denied.add(key);
    }
    for (const key of denied) result[key] = false;
    return result;
}

const routeFeatures: Record<string, string> = {
    "/inventory": "inventory",
    "/inventory-reconciliation": "inventory",
    "/customers": "customers",
    "/purchases": "purchases",
    "/suppliers": "suppliers",
    "/transfers": "stockTransfers",
    "/expenses": "finance",
    "/finance": "finance",
    "/shifts": "shifts",
    "/scrap": "scrap",
    "/services": "serviceOrders",
    "/printers": "printers",
    "/reports": "advancedReporting",
};

export function isRouteFeatureEnabled(
    path: string,
    flags: FeatureToggles,
): boolean {
    const root = "/" + path.split("/").filter(Boolean)[0];
    const feature = routeFeatures[root];
    return !feature || flags[feature] === true;
}

export interface FeatureFlag {
    feature_code: string;
    global_enabled: boolean;
    organization_enabled: boolean;
    business_type?: string;
    configuration_json?: Record<string, unknown>;
    effective_from?: string;
    effective_to?: string;
}

const aliases: Record<string, string> = {
    restaurant: "tables",
    pharmacy: "prescriptions",
    services: "serviceOrders",
    batch_inventory: "batchExpiry",
    expiry_tracking: "batchExpiry",
    serial_inventory: "serialNumbers",
    multi_branch: "multiBranch",
    barcode_printing: "barcodePrinting",
    credit_sales: "creditSales",
    customer_loyalty: "customerLoyalty",
};

export function featureKey(code: string): string {
    const key = code.replace(/\.enabled$/, "");
    return aliases[key] ?? key;
}

export function resolveFeatureFlag(
    flag: FeatureFlag,
    businessType?: string,
    now = Date.now(),
): boolean {
    if (!flag.global_enabled || !flag.organization_enabled) return false;
    if (
        flag.business_type &&
        flag.business_type !== "*" &&
        flag.business_type.toUpperCase() !== businessType?.toUpperCase()
    )
        return false;
    const from = flag.effective_from
        ? Date.parse(flag.effective_from)
        : -Infinity;
    const to = flag.effective_to ? Date.parse(flag.effective_to) : Infinity;
    return !Number.isNaN(from) && !Number.isNaN(to) && now >= from && now < to;
}

function isFeatureFlag(value: unknown): value is FeatureFlag {
    return (
        isRecord(value) &&
        typeof value.feature_code === "string" &&
        typeof value.global_enabled === "boolean" &&
        typeof value.organization_enabled === "boolean"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
