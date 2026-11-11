import { test, expect, surfaceOf, openPage } from '../support/app';

const shared = [
  ['/inventory', /Inventory/],
  ['/customers', /Customers|Contacts/],
  ['/purchases', /Purchases/],
  ['/reports', /Reports/],
  ['/printers', /Printers/],
  ['/shifts', /Shift/],
  ['/waybills', /Waybill/],
  ['/scrap', /Scrap/],
] as const;
const native = [
  ['/orders', /Orders/],
  ['/settings', /Settings/],
  ['/profile', /Profile/],
  ['/transfers', /Stock transfers|Stock Transfers/],
  ['/inventory-reconciliation', /Stock count|Stock Count|Reconciliation/],
  ['/shipping-bills', /Shipping/],
  ['/scrap-purchases', /Purchases/],
  ['/scrap-sales', /Sales/],
  ['/scrap-categories', /Categories/],
  ['/scrap-vendors', /Vendors/],
] as const;
const admin = [
  ['/branches', /Branches/],
  ['/counters', /Counters/],
  ['/tables', /Tables/],
  ['/staff-assignments', /Staff/],
  ['/payment-methods', /Payment/],
  ['/bank-accounts', /Bank/],
  ['/catalog-setup', /Catalog/],
] as const;
const react = [
  ['/', /Billing|Cart|Current Order/],
  ['/sales', /Sales/],
  ['/sales-dashboard', /Sales/],
  ['/admin-dashboard', /Dashboard/],
  ['/finance', /Finance/],
  ['/suppliers', /Suppliers/],
  ['/categories', /Categories/],
  ['/units', /Units/],
  ['/tax-rates', /Tax/],
  ['/payment-methods', /Payment/],
  ['/sync-jobs', /Sync/],
  ['/branches', /Branches/],
  ['/users', /Users|Team/],
  ['/stock-transfers', /Transfers/],
  ['/returns', /Returns/],
  ['/services', /Services/],
  ['/business-overview', /Business/],
  ['/admin', /Settings|Admin/],
] as const;

for (const [group, routes] of [
  ['shared', shared],
  ['native', native],
  ['admin', admin],
  ['react', react],
] as const) {
  for (const [path, marker] of routes) {
    test(`${group}: ${path} loads and survives reload`, async ({ page, baseURL }, info) => {
      const surface = surfaceOf(info);
      test.skip(
        (group === 'native' && surface === 'react') ||
          (group === 'admin' && surface !== 'admin') ||
          (group === 'react' && surface !== 'react'),
        'Different application route',
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await openPage(page, baseURL!, path, marker);
      await page.reload();
      await expect(page.getByText(marker).first()).toBeVisible();
      expect(errors, 'Uncaught browser errors').toEqual([]);
    });
  }
}

test('POS billing loads', async ({ page, baseURL }, info) => {
  test.skip(surfaceOf(info) !== 'pos', 'Store POS only');
  await openPage(page, baseURL!, '/billing', /Billing|Cart/);
});
