import { test, expect, openPage, databaseStores } from '../support/app';

for (const offline of [false, true]) {
  test(`POS product search, hold and resume (${offline ? 'offline' : 'online'})`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== 'pos-tablet', 'Tablet POS billing layout');
    const product = process.env.E2E_PRODUCT;
    expect(product, 'Set E2E_PRODUCT to a simple in-stock retail product').toBeTruthy();
    await openPage(page, baseURL!, '/billing', /Current order/);
    const search = page.getByPlaceholder('Search name, SKU or barcode', { exact: true });
    await search.fill(product!);
    const add = page.getByLabel(`Add ${product} to cart`, { exact: true });
    await expect(add).toBeVisible();
    try {
      await context.setOffline(offline);
      await search.fill('PW missing product 71822');
      await expect(add).not.toBeVisible();
      await search.fill(product!);
      await add.click();
      await expect(page.getByText('1 item in cart', { exact: true })).toBeVisible();
      const held = page.getByLabel(/^Held orders, /);
      const before = Number((await held.getAttribute('aria-label'))!.split(', ')[1]);
      await page.getByLabel('Hold current order', { exact: true }).click();
      await expect(page.getByText('Add items to start a sale', { exact: true })).toBeVisible();
      await expect(page.getByLabel(`Held orders, ${before + 1}`, { exact: true })).toBeVisible();
      const stores = await databaseStores(context);
      expect(JSON.stringify(stores.filter((store) => /held/i.test(store.name)))).toContain(product!);
      await page.getByLabel(`Held orders, ${before + 1}`, { exact: true }).click();
      // A fresh fixture must have no other held orders to make resume deterministic.
      await expect(page.getByText('Resume', { exact: true })).toHaveCount(1);
      await page.getByText('Resume', { exact: true }).click();
      await expect(page.getByText('1 item in cart', { exact: true })).toBeVisible();
      await expect(page.getByLabel(`Held orders, ${before}`, { exact: true })).toBeVisible();
      await page.getByText('Clear', { exact: true }).click();
      await expect(page.getByText('Add items to start a sale', { exact: true })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
}
