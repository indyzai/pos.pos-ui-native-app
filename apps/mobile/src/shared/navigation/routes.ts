import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftRight,
  ChartPie,
  Clock,
  LayoutGrid,
  Package,
  ReceiptText,
  Settings,
  Users,
  Wallet,
} from 'lucide-react-native';

export type AppNavigationItem = { label: string; icon: LucideIcon; href: Href };

export const primaryNavigationItems: AppNavigationItem[] = [
  { label: 'Billing', icon: LayoutGrid, href: '/billing' },
  { label: 'Orders', icon: ReceiptText, href: '/orders' },
];

export const reportNavigationItem: AppNavigationItem = {
  label: 'Reports',
  icon: ChartPie,
  href: '/reports',
};

export const moreNavigationItems: AppNavigationItem[] = [
  { label: 'Customers', icon: Users, href: '/customers' },
  { label: 'Inventory', icon: Package, href: '/inventory' },
  { label: 'Transfers', icon: ArrowLeftRight, href: '/transfers' },
  { label: 'Expenses', icon: Wallet, href: '/expenses' },
  { label: 'Shifts', icon: Clock, href: '/shifts' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export const tabletNavigationItems = [
  ...primaryNavigationItems,
  moreNavigationItems[0],
  moreNavigationItems[1],
  reportNavigationItem,
  moreNavigationItems[5],
];

export function isNavigationItemActive(pathname: string, href: Href): boolean {
  const target = typeof href === 'string' ? href : href.pathname;
  return pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
}
