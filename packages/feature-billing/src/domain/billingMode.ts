export type BillingMode =
    | "retail"
    | "pharmacy"
    | "restaurant"
    | "wholesale"
    | "service"
    | "electronics";

export type BillingModeConfig = {
    mode: BillingMode;
    label: string;
    catalogTitle: string;
    searchPlaceholder: string;
    scanByDefault: boolean;
    showQuickPicks: boolean;
};

const modes: Record<BillingMode, Omit<BillingModeConfig, "mode">> = {
    retail: {
        label: "Retail",
        catalogTitle: "Popular products",
        searchPlaceholder: "Search name, SKU or barcode",
        scanByDefault: true,
        showQuickPicks: true,
    },
    pharmacy: {
        label: "Pharmacy",
        catalogTitle: "Medicines",
        searchPlaceholder: "Search medicine, SKU or barcode",
        scanByDefault: true,
        showQuickPicks: true,
    },
    restaurant: {
        label: "Restaurant",
        catalogTitle: "Menu",
        searchPlaceholder: "Search menu items",
        scanByDefault: false,
        showQuickPicks: false,
    },
    wholesale: {
        label: "Wholesale",
        catalogTitle: "Bulk products",
        searchPlaceholder: "Search products for bulk order",
        scanByDefault: true,
        showQuickPicks: true,
    },
    service: {
        label: "Service",
        catalogTitle: "Services and parts",
        searchPlaceholder: "Search services or parts",
        scanByDefault: false,
        showQuickPicks: false,
    },
    electronics: {
        label: "Electronics",
        catalogTitle: "Products",
        searchPlaceholder: "Search product, serial, SKU or barcode",
        scanByDefault: true,
        showQuickPicks: true,
    },
};

export function resolveBillingMode(
    value: unknown,
    settings?: Record<string, unknown>,
): BillingModeConfig {
    const normalized = String(value || "retail")
        .trim()
        .toLowerCase();
    let resolvedMode: BillingMode =
        normalized === "supermarket"
            ? "retail"
            : modes[normalized as BillingMode]
              ? (normalized as BillingMode)
              : "retail";
    if (settings) {
        const flags = resolveFeatureToggles({
            ...settings,
            businessType: value,
        });
        const requiredFeature: Partial<Record<BillingMode, string>> = {
            restaurant: "tables",
            pharmacy: "prescriptions",
            wholesale: "bulkPricing",
            service: "serviceOrders",
            electronics: "serialNumbers",
        };
        const feature = requiredFeature[resolvedMode];
        if (feature && !flags[feature]) resolvedMode = "retail";
    }
    return { mode: resolvedMode, ...modes[resolvedMode] };
}

export function getBillingBootstrapCollections(
    mode: BillingMode,
    settings?: Record<string, unknown>,
): string[] {
    const flags = resolveFeatureToggles({ businessType: mode, ...settings });
    const core = [
        "products",
        ...(flags.customers ? ["customers"] : []),
        "paymentMethods",
        "taxRates",
        "counterSessions",
    ];
    switch (mode) {
        case "pharmacy":
            return flags.batchExpiry ? [...core, "productBatches"] : core;
        case "service":
            return flags.serviceOrders ? [...core, "serviceUsers"] : core;
        case "restaurant":
            return flags.tables ? [...core, "tables"] : core;
        default:
            return core;
    }
}
import { resolveFeatureToggles } from "@indyzai/feature-flags";
