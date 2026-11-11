import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  surfaceOf,
  openPage,
  createCustomer,
  customerSearch,
  databaseStores,
} from '../support/app';

for (const offline of [false, true]) {
  test(`customer creation, durable persistence and recovery (${offline ? 'offline' : 'online'})`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    const surface = surfaceOf(info);
    const name = `PW ${randomUUID()}`;
    await openPage(page, baseURL!, '/customers', /Customers|Contacts/);
    await expect(customerSearch(page, surface)).toBeVisible();
    try {
      await context.setOffline(offline);
      expect(await page.evaluate(() => navigator.onLine)).toBe(!offline);
      await createCustomer(page, surface, name);
      // Inspect the real browser database, without injecting records or replacing repositories.
      await expect
        .poll(async () => {
          return JSON.stringify(await databaseStores(context));
        })
        .toContain(name);
      if (offline) {
        await expect
          .poll(
            async () => {
              const stores = await databaseStores(context);
              return JSON.stringify(stores.filter((store) => store.name === 'sync_jobs'));
            },
            { message: 'Offline customer mutation is durably queued' },
          )
          .toContain(name);
        // Exercise local filtering while the browser network is still unavailable.
        await customerSearch(page, surface).fill(`${name} missing`);
        await expect(page.getByText(name, { exact: true })).not.toBeVisible();
        await customerSearch(page, surface).fill(name);
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      }
    } finally {
      await context.setOffline(false);
    }
    await page.reload();
    await expect(customerSearch(page, surface)).toBeVisible();
    await customerSearch(page, surface).fill(name);
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  });
}

test('cached customer search remains usable through repeated disconnects', async ({
  page,
  context,
  baseURL,
}, info) => {
  const surface = surfaceOf(info);
  const name = process.env.E2E_CACHED_CUSTOMER;
  expect(name, 'Set E2E_CACHED_CUSTOMER to a seeded customer name').toBeTruthy();
  await openPage(page, baseURL!, '/customers', /Customers|Contacts/);
  await customerSearch(page, surface).fill(name!);
  await expect(page.getByText(name!, { exact: true }).first()).toBeVisible();
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      await context.setOffline(true);
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      await customerSearch(page, surface).fill('PW nonexistent customer 7f12b');
      await expect(page.getByText(name!, { exact: true })).not.toBeVisible();
      await customerSearch(page, surface).fill(name!);
      await expect(page.getByText(name!, { exact: true }).first()).toBeVisible();
      await context.setOffline(false);
      await expect(page.getByText(name!, { exact: true }).first()).toBeVisible();
    }
  } finally {
    await context.setOffline(false);
  }
});
