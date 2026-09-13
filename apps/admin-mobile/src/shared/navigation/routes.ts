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
    { label: 'Reports', icon: ChartPie, href: '/reports' },
    { label: 'Inventory', icon: Package, href: '/inventory' },
];

export const orderNavigationItem: AppNavigationItem = {
    label: 'Orders',
    icon: ReceiptText,
    href: '/orders',
};

export const moreNavigationItems: AppNavigationItem[] = [
    { label: 'POS Billing', icon: LayoutGrid, href: '/billing' },
    { label: 'Customers', icon: Users, href: '/customers' },
    { label: 'Transfers', icon: ArrowLeftRight, href: '/transfers' },
    { label: 'Expenses', icon: Wallet, href: '/expenses' },
    { label: 'Shifts', icon: Clock, href: '/shifts' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

export const tabletNavigationItems = [
    ...primaryNavigationItems,
    orderNavigationItem,
    moreNavigationItems[0],
    moreNavigationItems[1],
    moreNavigationItems[5],
];

export function isNavigationItemActive(pathname: string, href: Href): boolean {
    const target = typeof href === 'string' ? href : href.pathname;
    return pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
}
