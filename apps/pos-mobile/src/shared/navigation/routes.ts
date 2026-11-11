import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftRight,
  CreditCard,
  FileText,
  History,
  Landmark,
  PackageMinus,
  PackagePlus,
  Recycle,
  Tags,
  Truck,
  ChartPie,
  ClipboardCheck,
  LayoutGrid,
  Package,
  Printer,
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
  children?: AppNavigationItem[];
  surfaces?: readonly ('pos' | 'admin')[];
  entitlement?: Entitlement;
};

export function navigationItemsForRole(
  items: readonly AppNavigationItem[],
  role: StoreAccessRole,
  flags?: FeatureToggles,
) {
  return items.flatMap((item): AppNavigationItem[] => {
    if (item.children) {
      const children = navigationItemsForRole(item.children, role, flags);
      return children.length ? [{ ...item, href: children[0].href, children }] : [];
    }
    if (item.surfaces && !item.surfaces.includes('pos')) return [];
    const path = typeof item.href === 'string' ? item.href : item.href.pathname;
    const visible =
      (!item.entitlement || hasEntitlement(item.entitlement, role, role, 'pos')) &&
      (!flags || isRouteFeatureEnabled(path, flags));
    return visible ? [item] : [];
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

const modulePages: AppNavigationItem[] = [
  { label: 'Printers', icon: Printer, href: '/printers', entitlement: 'billing.create' },
  { label: 'Vendors', icon: Users, href: '/scrap-vendors', entitlement: 'manager.actions' },
  { label: 'Stock transfers', icon: ArrowLeftRight, href: '/transfers', entitlement: 'inventory.transfer' },
  { label: 'Shift history', icon: History, href: '/shifts', entitlement: 'reports.view' },
  { label: 'Waybills', icon: FileText, href: '/waybills', entitlement: 'manager.actions' },
  { label: 'Shipping bills', icon: Truck, href: '/shipping-bills', entitlement: 'manager.actions' },
  { label: 'Scrap inventory', icon: Recycle, href: '/scrap', entitlement: 'manager.actions' },
  { label: 'Scrap purchases', icon: PackagePlus, href: '/scrap-purchases', entitlement: 'manager.actions' },
  { label: 'Scrap categories', icon: Tags, href: '/scrap-categories', entitlement: 'manager.actions' },
  { label: 'Scrap sales', icon: PackageMinus, href: '/scrap-sales', entitlement: 'manager.actions' },
  {
    label: 'Payment methods',
    icon: CreditCard,
    href: '/payment-methods',
    surfaces: ['admin'],
    entitlement: 'manager.actions',
  },
  {
    label: 'Bank accounts',
    icon: Landmark,
    href: '/bank-accounts',
    surfaces: ['admin'],
    entitlement: 'manager.actions',
  },

  {
    label: 'Stock count',
    icon: ClipboardCheck,
    href: '/inventory-reconciliation',
    entitlement: 'inventory.reconcile',
  },
  { label: 'Contacts', icon: Users, href: '/customers', entitlement: 'billing.create' },
  { label: 'Orders', icon: ReceiptText, href: '/orders', entitlement: 'reports.view' },
  { label: 'Purchases', icon: ShoppingBag, href: '/purchases', entitlement: 'purchases.view' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

const module = (label: string, icon: LucideIcon, paths: string[]): AppNavigationItem => {
  const children = paths.flatMap((path) => modulePages.filter((item) => String(item.href) === path));
  return { label, icon, href: children[0].href, children };
};
const scrapModule = module('Scrap', Recycle, [
  '/scrap',
  '/scrap-purchases',
  '/scrap-sales',
  '/scrap-categories',
  '/scrap-vendors',
]);
const operationsModule = module('Operations', ReceiptText, ['/orders', '/purchases', '/shifts']);
operationsModule.children = [...(operationsModule.children ?? []), scrapModule];

export const moreNavigationItems: AppNavigationItem[] = [
  module('Masters', Users, ['/customers', '/payment-methods', '/bank-accounts']),
  operationsModule,
  module('Logistics', Truck, ['/transfers', '/inventory-reconciliation', '/waybills', '/shipping-bills']),
  module('Management', Printer, ['/printers']),
  ...modulePages.filter((item) => item.href === '/settings'),
];

export const tabletNavigationItems: AppNavigationItem[] = [
  ...primaryNavigationItems,
  ...moreNavigationItems.filter((item) => item.href !== '/settings'),
  reportNavigationItem,
  ...moreNavigationItems.filter((item) => item.href === '/settings'),
];

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
