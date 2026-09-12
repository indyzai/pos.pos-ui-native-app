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

const typeDefaults: Record<string, Partial<FeatureToggles>> = {
    PHARMACY: { prescriptions: true, batchExpiry: true },
    RESTAURANT: { tables: true },
    WHOLESALE: { bulkPricing: true },
    SERVICE: { serviceOrders: true },
    ELECTRONICS: { serialNumbers: true, serviceOrders: true },
};

export const featureToggleLabels: Record<string, string> = {
    inventory: 'Inventory',
    customers: 'Customers',
    suppliers: 'Suppliers',
    finance: 'Finance',
    purchases: 'Purchases',
    returns: 'Returns and refunds',
    shifts: 'Counter shifts',
    scrap: 'Scrap exchange',
    stockTransfers: 'Stock transfers',
    waybills: 'Waybills',
    multiBranch: 'Multiple branches',
    printers: 'Printing',
    advancedReporting: 'Session reporting',
    prescriptions: 'Prescriptions',
    batchExpiry: 'Batch and expiry tracking',
    tables: 'Restaurant tables',
    bulkPricing: 'Bulk pricing',
    serviceOrders: 'Service orders',
    serialNumbers: 'Serial numbers',
    enableBarcodeScanning: 'Barcode scanning',
    allowItemDiscounts: 'Item discounts',
    allowOrderDiscounts: 'Order discounts',
    requireOpenCounterForBilling: 'Require open counter',
};

export function resolveFeatureToggles(settings?: Record<string, unknown>): FeatureToggles {
    const businessType = String(settings?.businessType || 'RETAIL').toUpperCase();
    const nested = isRecord(settings?.features) ? settings.features : {};
    const configured = Object.fromEntries(
        [...Object.entries(settings || {}), ...Object.entries(nested)].filter(
            ([key, value]) => key !== 'features' && typeof value === 'boolean',
        ),
    ) as FeatureToggles;
    if (
        configured.requireOpenCounterForBilling === undefined &&
        typeof configured.requireCounterSessionForBilling === 'boolean'
    ) {
        configured.requireOpenCounterForBilling = configured.requireCounterSessionForBilling;
    }
    delete configured.requireCounterSessionForBilling;
    return { ...baseDefaults, ...typeDefaults[businessType], ...configured };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
