import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ChartPie,
  ClipboardCheck,
  LayoutGrid,
  Package,
  ShoppingBag,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react-native';
import { type Entitlement, hasEntitlement } from '@indyzai/pos-permissions';
import { resolveStoreAccessRole, type StoreAccessRole } from './access';
import { isRouteFeatureEnabled, type FeatureToggles } from '@indyzai/feature-flags';
export { resolveStoreAccessRole };

export type AppNavigationItem = {
  label: string;
  icon: LucideIcon;
  href: Href;
  entitlement?: Entitlement;
};

export function navigationItemsForRole(
  items: readonly AppNavigationItem[],
  role: StoreAccessRole,
  flags?: FeatureToggles,
) {
  return items.filter((item) => {
    const path = typeof item.href === 'string' ? item.href : item.href.pathname;
    return (
      (!item.entitlement || hasEntitlement(item.entitlement, role, role, 'pos')) &&
      (!flags || isRouteFeatureEnabled(path, flags))
    );
  });
}

export const primaryNavigationItems: AppNavigationItem[] = [
  { label: 'Billing', icon: LayoutGrid, href: '/billing', entitlement: 'billing.create' },
  { label: 'Inventory', icon: Package, href: '/inventory', entitlement: 'inventory.view' },
];

export const reportNavigationItem: AppNavigationItem = {
  label: 'Reports',
  icon: ChartPie,
  href: '/reports',
  entitlement: 'reports.view',
};

export const moreNavigationItems: AppNavigationItem[] = [
  {
    label: 'Stock count',
    icon: ClipboardCheck,
    href: '/inventory-reconciliation',
    entitlement: 'inventory.reconcile',
  },
  { label: 'Customers', icon: Users, href: '/customers', entitlement: 'billing.create' },
  { label: 'Orders', icon: ReceiptText, href: '/orders', entitlement: 'reports.view' },
  { label: 'Purchases', icon: ShoppingBag, href: '/purchases', entitlement: 'purchases.view' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export const tabletNavigationItems: AppNavigationItem[] = [
  ...primaryNavigationItems,
  moreNavigationItems[0],
  moreNavigationItems[1],
  reportNavigationItem,
  ...moreNavigationItems.filter((item) => item.href === '/settings'),
];

export function isNavigationItemActive(pathname: string, href: Href): boolean {
  const target = typeof href === 'string' ? href : href.pathname;
  return pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
}
