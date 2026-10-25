import { expect, mock, test } from 'bun:test';
const iconNames = [
  'ArrowLeftRight',
  'Building2',
  'CreditCard',
  'FileText',
  'History',
  'Landmark',
  'Monitor',
  'PackageMinus',
  'PackagePlus',
  'Recycle',
  'Table2',
  'Tags',
  'Truck',
  'UserRoundCog',
  'Warehouse',
  'ChartPie',
  'ClipboardCheck',
  'Package',
  'Printer',
  'ShoppingBag',
  'ReceiptText',
  'Settings',
  'Users',
  'LayoutGrid',
];
mock.module('lucide-react-native', () => Object.fromEntries(iconNames.map((name) => [name, () => null])));
const pos = await import('../../../src/shared/navigation/routes');
const admin = await import('../../../../admin-mobile/src/shared/navigation/routes');
const { resolveFeatureToggles, applyBranchAvailability } = await import('@indyzai/feature-flags');
const { isNavigationGroupActive } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src/navigation/types'
);
const flags = resolveFeatureToggles({ businessType: 'RESTAURANT' });

test('related routes appear only within their submodule and retain unique destinations', () => {
  for (const routes of [pos, admin]) {
    const paths = routes.moreNavigationItems
      .flatMap((item) => item.children || [item])
      .map((item) => String(item.href));
    expect(new Set(paths).size).toBe(paths.length);
    expect(
      routes.moreNavigationItems.find((item) => item.label === 'Logistics').children.map((item) => item.href),
    ).toEqual(['/waybills', '/shipping-bills']);
    expect(routes.moreNavigationItems.some((item) => item.label === 'Bank accounts')).toBe(false);
    expect(routes.moreNavigationItems.find((item) => item.label === 'Payments').children).toHaveLength(2);
  }
});
test('permissions and feature flags filter child pages and remove empty submodules', () => {
  const cashier = pos.navigationItemsForRole(pos.moreNavigationItems, 'cashier', flags);
  expect(cashier.some((item) => ['Payments', 'Logistics', 'Scrap'].includes(item.label))).toBe(false);
  const manager = pos.navigationItemsForRole(pos.moreNavigationItems, 'manager', {
    ...flags,
    stockTransfers: false,
    scrap: false,
    waybills: false,
  });
  expect(manager.some((item) => ['Scrap', 'Logistics'].includes(item.label))).toBe(false);
  const stock = manager.find((item) => item.label === 'Stock control');
  expect(stock.children.map((item) => item.href)).toEqual(['/inventory-reconciliation']);
  expect(stock.href).toBe('/inventory-reconciliation');
  const organization = admin
    .visibleNavigationItems(admin.moreNavigationItems, { ...flags, multiBranch: false }, 'admin', 'admin')
    .find((item) => item.label === 'Organization');
  expect(organization.children.some((item) => item.href === '/branches')).toBe(false);
  expect(organization.children.some((item) => item.href === '/tables')).toBe(true);
});
test('a non-first child keeps its parent module active', () => {
  const payments = pos.moreNavigationItems.find((item) => item.label === 'Payments');
  expect(
    isNavigationGroupActive(payments, (href) => pos.isNavigationItemActive('/bank-accounts', href)),
  ).toBe(true);
  expect(isNavigationGroupActive(payments, (href) => pos.isNavigationItemActive('/orders', href))).toBe(
    false,
  );
});

test('route guards allow every enabled module tab instead of redirecting non-first tabs', () => {
  const posItems = pos.navigationItemsForRole(
    [...pos.primaryNavigationItems, ...pos.moreNavigationItems, pos.reportNavigationItem],
    'manager',
    flags,
  );
  const adminItems = admin.visibleNavigationItems(
    [...admin.primaryNavigationItems, ...admin.moreNavigationItems, admin.orderNavigationItem],
    flags,
    'admin',
    'admin',
  );
  for (const [routes, items] of [
    [pos, posItems],
    [admin, adminItems],
  ]) {
    for (const module of items.filter((item) => item.children)) {
      for (const tab of module.children) {
        expect(routes.isNavigationRouteAllowed(String(tab.href), items)).toBe(true);
      }
    }
    expect(routes.isNavigationRouteAllowed('/not-a-route', items)).toBe(false);
    expect(routes.isNavigationRouteAllowed('/bank-accounts-unrelated', items)).toBe(false);
  }
  expect(pos.isNavigationRouteAllowed('/shipping-bills', posItems)).toBe(true);
  expect(admin.isNavigationRouteAllowed('/staff-assignments', adminItems)).toBe(true);
});
test('route guards still reject tabs hidden by permissions or business features', () => {
  const cashier = pos.navigationItemsForRole(pos.moreNavigationItems, 'cashier', flags);
  expect(pos.isNavigationRouteAllowed('/bank-accounts', cashier)).toBe(false);
  expect(pos.isNavigationRouteAllowed('/scrap-sales', cashier)).toBe(false);
  const disabled = { ...flags, scrap: false, waybills: false, multiBranch: false };
  for (const [routes, items] of [
    [pos, pos.navigationItemsForRole(pos.moreNavigationItems, 'manager', disabled)],
    [admin, admin.visibleNavigationItems(admin.moreNavigationItems, disabled, 'admin', 'admin')],
  ]) {
    expect(routes.isNavigationRouteAllowed('/scrap-vendors', items)).toBe(false);
    expect(routes.isNavigationRouteAllowed('/shipping-bills', items)).toBe(false);
  }
});

test('stock transfer tabs and routes require multiple distinct branches', () => {
  for (const branches of [
    undefined,
    [],
    [{ id: '1' }],
    [{ id: '1' }, { id: '1' }],
    [{ id: '1' }, { id: '2', isActive: false }],
  ]) {
    const limited = applyBranchAvailability(flags, branches);
    const posItems = pos.navigationItemsForRole(pos.moreNavigationItems, 'manager', limited);
    const adminItems = admin.visibleNavigationItems(admin.moreNavigationItems, limited, 'admin', 'admin');
    expect(pos.isNavigationRouteAllowed('/transfers', posItems)).toBe(false);
    expect(admin.isNavigationRouteAllowed('/transfers', adminItems)).toBe(false);
    expect(pos.isNavigationRouteAllowed('/inventory-reconciliation', posItems)).toBe(true);
  }
  const multiple = [{ id: '1' }, { id: '2' }];
  expect(applyBranchAvailability(flags, multiple).stockTransfers).toBe(true);
  expect(applyBranchAvailability({ ...flags, stockTransfers: false }, multiple).stockTransfers).toBe(false);
  expect(applyBranchAvailability({ ...flags, multiBranch: false }, multiple).stockTransfers).toBe(false);
});

test('Admin retains operational oversight and setup while POS hides business setup', () => {
  const posItems = pos.navigationItemsForRole(pos.moreNavigationItems, 'manager', flags);
  const adminItems = admin.visibleNavigationItems(admin.moreNavigationItems, flags, 'admin', 'admin');
  for (const route of ['/shipping-bills', '/scrap-purchases', '/scrap-sales', '/shifts', '/purchases']) {
    expect(pos.isNavigationRouteAllowed(route, posItems)).toBe(true);
    expect(admin.isNavigationRouteAllowed(route, adminItems)).toBe(true);
  }
  for (const route of [
    '/payment-methods',
    '/bank-accounts',
    '/branches',
    '/counters',
    '/staff-assignments',
    '/catalog-setup',
  ]) {
    expect(pos.isNavigationRouteAllowed(route, posItems)).toBe(false);
    expect(admin.isNavigationRouteAllowed(route, adminItems)).toBe(true);
  }
  expect(pos.isNavigationRouteAllowed('/printers', posItems)).toBe(true);
  expect(admin.isNavigationRouteAllowed('/printers', adminItems)).toBe(true);
});

test('Admin exposes every implemented module when its role and business features allow it', () => {
  const items = admin.visibleNavigationItems(admin.tabletNavigationItems, flags, 'admin', 'admin');
  const paths = [
    '/reports',
    '/inventory',
    '/orders',
    '/transfers',
    '/inventory-reconciliation',
    '/waybills',
    '/shipping-bills',
    '/scrap',
    '/scrap-purchases',
    '/scrap-sales',
    '/scrap-categories',
    '/scrap-vendors',
    '/payment-methods',
    '/bank-accounts',
    '/branches',
    '/counters',
    '/tables',
    '/staff-assignments',
    '/catalog-setup',
    '/shifts',
    '/customers',
    '/purchases',
    '/printers',
    '/settings',
  ];
  for (const path of paths) expect(admin.isNavigationRouteAllowed(path, items)).toBe(true);
  expect(items.filter((item) => item.children).map((item) => item.label)).toEqual([
    'Stock control',
    'Logistics',
    'Scrap',
    'Payments',
    'Organization',
  ]);
});
