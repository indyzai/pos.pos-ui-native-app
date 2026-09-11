export type BillingMode = 'retail' | 'pharmacy' | 'restaurant' | 'wholesale' | 'service' | 'electronics';

export type BillingModeConfig = {
  mode: BillingMode;
  label: string;
  catalogTitle: string;
  searchPlaceholder: string;
  scanByDefault: boolean;
  showQuickPicks: boolean;
};

const modes: Record<BillingMode, Omit<BillingModeConfig, 'mode'>> = {
  retail: {
    label: 'Retail',
    catalogTitle: 'Popular products',
    searchPlaceholder: 'Search name, SKU or barcode',
    scanByDefault: true,
    showQuickPicks: true,
  },
  pharmacy: {
    label: 'Pharmacy',
    catalogTitle: 'Medicines',
    searchPlaceholder: 'Search medicine, SKU or barcode',
    scanByDefault: true,
    showQuickPicks: true,
  },
  restaurant: {
    label: 'Restaurant',
    catalogTitle: 'Menu',
    searchPlaceholder: 'Search menu items',
    scanByDefault: false,
    showQuickPicks: false,
  },
  wholesale: {
    label: 'Wholesale',
    catalogTitle: 'Bulk products',
    searchPlaceholder: 'Search products for bulk order',
    scanByDefault: true,
    showQuickPicks: true,
  },
  service: {
    label: 'Service',
    catalogTitle: 'Services and parts',
    searchPlaceholder: 'Search services or parts',
    scanByDefault: false,
    showQuickPicks: false,
  },
  electronics: {
    label: 'Electronics',
    catalogTitle: 'Products',
    searchPlaceholder: 'Search product, serial, SKU or barcode',
    scanByDefault: true,
    showQuickPicks: true,
  },
};

export function resolveBillingMode(value: unknown): BillingModeConfig {
  const normalized = String(value || 'retail')
    .trim()
    .toLowerCase() as BillingMode;
  const mode = modes[normalized] ? normalized : 'retail';
  return { mode, ...modes[mode] };
}
