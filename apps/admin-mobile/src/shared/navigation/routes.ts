import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { isRouteFeatureEnabled, type FeatureToggles } from '@indyzai/feature-flags';
import {
  ChartPie,
  ClipboardCheck,
  Package,
  ShoppingBag,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react-native';
import { type Entitlement, hasEntitlement } from '@indyzai/pos-permissions';

export type AppNavigationItem = { label: string; icon: LucideIcon; href: Href; entitlement?: Entitlement };

export function visibleNavigationItems(
  items: readonly AppNavigationItem[],
  flags: FeatureToggles,
  tenantRole?: unknown,
  accountRole?: unknown,
) {
  return items.filter(
    (item) =>
      isRouteFeatureEnabled(typeof item.href === 'string' ? item.href : item.href.pathname, flags) &&
      (!item.entitlement || hasEntitlement(item.entitlement, tenantRole, accountRole, 'admin')),
  );
}

export const primaryNavigationItems: AppNavigationItem[] = [
  { label: 'Reports', icon: ChartPie, href: '/reports', entitlement: 'reports.view' },
  { label: 'Inventory', icon: Package, href: '/inventory', entitlement: 'inventory.view' },
];

export const orderNavigationItem: AppNavigationItem = {
  label: 'Orders',
  icon: ReceiptText,
  href: '/orders',
  entitlement: 'reports.view',
};

export const moreNavigationItems: AppNavigationItem[] = [
  {
    label: 'Stock count',
    icon: ClipboardCheck,
    href: '/inventory-reconciliation',
    entitlement: 'inventory.reconcile',
  },
  { label: 'Purchases', icon: ShoppingBag, href: '/purchases', entitlement: 'purchases.view' },
  { label: 'Customers', icon: Users, href: '/customers', entitlement: 'organization.manage' },
  { label: 'Team', icon: Users, href: '/team', entitlement: 'users.manage' },
  { label: 'Settings', icon: Settings, href: '/settings', entitlement: 'organization.manage' },
];

export const tabletNavigationItems = [
  ...primaryNavigationItems,
  orderNavigationItem,
  ...moreNavigationItems.filter((item) =>
    ['/inventory-reconciliation', '/customers', '/team', '/settings'].includes(String(item.href)),
  ),
];

export function isNavigationItemActive(pathname: string, href: Href): boolean {
  const target = typeof href === 'string' ? href : href.pathname;
  return pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
}
