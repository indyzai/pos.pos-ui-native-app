import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { isRouteFeatureEnabled, type FeatureToggles } from '@indyzai/feature-flags';
import {
  ArrowLeftRight,
  Building2,
  CreditCard,
  FileText,
  History,
  Landmark,
  Monitor,
  PackageMinus,
  PackagePlus,
  Recycle,
  Table2,
  Tags,
  Truck,
  UserRoundCog,
  Warehouse,
  ChartPie,
  ClipboardCheck,
  Package,
  Printer,
  ShoppingBag,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react-native';
import { type Entitlement, hasEntitlement } from '@indyzai/pos-permissions';

export type AppNavigationItem = {
  label: string;
  icon: LucideIcon;
  href: Href;
  children?: AppNavigationItem[];
  surfaces?: readonly ('pos' | 'admin')[];
  entitlement?: Entitlement;
};

export function visibleNavigationItems(
  items: readonly AppNavigationItem[],
  flags: FeatureToggles,
  tenantRole?: unknown,
  accountRole?: unknown,
) {
  return items.flatMap((item): AppNavigationItem[] => {
    if (item.children) {
      const children = visibleNavigationItems(item.children, flags, tenantRole, accountRole);
      return children.length ? [{ ...item, href: children[0].href, children }] : [];
    }
    if (item.surfaces && !item.surfaces.includes('admin')) return [];
    const visible =
      isRouteFeatureEnabled(typeof item.href === 'string' ? item.href : item.href.pathname, flags) &&
      (!item.entitlement || hasEntitlement(item.entitlement, tenantRole, accountRole, 'admin'));
    return visible ? [item] : [];
  });
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

const modulePages: AppNavigationItem[] = [
  { label: 'Printers', icon: Printer, href: '/printers', entitlement: 'organization.manage' },
  {
    label: 'Vendors',
    icon: Users,
    href: '/scrap-vendors',
    entitlement: 'manager.actions',
  },
  {
    label: 'Stock transfers',
    icon: ArrowLeftRight,
    href: '/transfers',
    entitlement: 'inventory.transfer',
  },
  { label: 'Shift history', icon: History, href: '/shifts', entitlement: 'reports.view' },
  { label: 'Waybills', icon: FileText, href: '/waybills', entitlement: 'manager.actions' },
  {
    label: 'Shipping bills',
    icon: Truck,
    href: '/shipping-bills',
    entitlement: 'manager.actions',
  },
  {
    label: 'Scrap inventory',
    icon: Recycle,
    href: '/scrap',
    entitlement: 'manager.actions',
  },
  {
    label: 'Scrap purchases',
    icon: PackagePlus,
    href: '/scrap-purchases',
    entitlement: 'manager.actions',
  },
  {
    label: 'Scrap categories',
    icon: Tags,
    href: '/scrap-categories',
    entitlement: 'manager.actions',
  },
  {
    label: 'Scrap sales',
    icon: PackageMinus,
    href: '/scrap-sales',
    entitlement: 'manager.actions',
  },
  { label: 'Payment methods', icon: CreditCard, href: '/payment-methods', entitlement: 'manager.actions' },
  { label: 'Bank accounts', icon: Landmark, href: '/bank-accounts', entitlement: 'manager.actions' },
  { label: 'Branches', icon: Building2, href: '/branches', entitlement: 'organization.manage' },
  { label: 'Counters', icon: Monitor, href: '/counters', entitlement: 'organization.manage' },
  { label: 'Restaurant tables', icon: Table2, href: '/tables', entitlement: 'organization.manage' },
  {
    label: 'Staff assignments',
    icon: UserRoundCog,
    href: '/staff-assignments',
    entitlement: 'organization.manage',
  },

  {
    label: 'Stock count',
    icon: ClipboardCheck,
    href: '/inventory-reconciliation',
    entitlement: 'inventory.reconcile',
  },
  {
    label: 'Purchases',
    icon: ShoppingBag,
    href: '/purchases',
    entitlement: 'purchases.view',
  },
  { label: 'Contacts', icon: Users, href: '/customers', entitlement: 'organization.manage' },
  { label: 'Catalog setup', icon: Tags, href: '/catalog-setup', entitlement: 'organization.manage' },
  { label: 'Settings', icon: Settings, href: '/settings', entitlement: 'organization.manage' },
];

const module = (label: string, icon: LucideIcon, paths: string[]): AppNavigationItem => {
  const children = paths.flatMap((path) => modulePages.filter((item) => String(item.href) === path));
  return { label, icon, href: children[0].href, children };
};
export const moreNavigationItems: AppNavigationItem[] = [
  module('Stock control', Warehouse, ['/transfers', '/inventory-reconciliation']),
  module('Logistics', Truck, ['/waybills', '/shipping-bills']),
  module('Scrap', Recycle, [
    '/scrap',
    '/scrap-purchases',
    '/scrap-sales',
    '/scrap-categories',
    '/scrap-vendors',
  ]),
  module('Payments', CreditCard, ['/payment-methods', '/bank-accounts']),
  module('Organization', Building2, [
    '/branches',
    '/counters',
    '/tables',
    '/staff-assignments',
    '/catalog-setup',
  ]),
  ...modulePages.filter((item) =>
    ['/shifts', '/customers', '/orders', '/purchases', '/printers', '/settings'].includes(String(item.href)),
  ),
];

export const tabletNavigationItems = [...primaryNavigationItems, orderNavigationItem, ...moreNavigationItems];

export function isNavigationItemActive(pathname: string, href: Href): boolean {
  const target = typeof href === 'string' ? href : href.pathname;
  return pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
}

/** Check permitted destinations, including every page exposed as a module tab. */
export function isNavigationRouteAllowed(pathname: string, items: readonly AppNavigationItem[]): boolean {
  return items.some((item) =>
    item.children
      ? isNavigationRouteAllowed(pathname, item.children)
      : isNavigationItemActive(pathname, item.href),
  );
}
