import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Surface = 'react' | 'pos' | 'admin';
export const surfaceOf = (info: TestInfo) => info.project.metadata.surface as Surface;
export function appURL(baseURL: string, path: string) {
  return `${baseURL.replace(/\/$/, '')}${path === '/' ? '/' : path}`;
}

export const test = base.extend({
  storageState: async ({}, use, info) => {
    const surface = surfaceOf(info);
    const path = resolve(process.env[`E2E_${surface.toUpperCase()}_STATE`] || `e2e/.auth/${surface}.json`);
    if (!existsSync(path))
      throw new Error(`Missing ${path}. See e2e/README.md to capture a seeded test session.`);
    const manifestPath = resolve('e2e/.auth/release-tenant.json');
    const tenantId =
      process.env.E2E_TENANT_ID ||
      (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).tenantId : undefined);
    if (tenantId) {
      const state = JSON.parse(readFileSync(path, 'utf8')) as {
        origins: { localStorage: { name: string; value: string }[] }[];
      };
      const key = {
        react: 'auth_selected_tenant',
        pos: 'indyzai.selected-tenant',
        admin: 'indyzai.admin.selected-tenant',
      }[surface];
      const selected = state.origins
        .flatMap((origin) => origin.localStorage)
        .filter((entry) => entry.name === key);
      if (!selected.length || selected.some((entry) => entry.value !== tenantId))
        throw new Error('E2E session must select the dedicated test tenant. Capture a new session.');
    }
    await use(path);
  },
});
export { expect };

export async function openPage(page: Page, baseURL: string, path: string, marker: RegExp) {
  await page.goto(appURL(baseURL, path));
  await expect(page).toHaveURL(appURL(baseURL, path));
  await expect(page.getByText(marker).first()).toBeVisible();
  await expect(
    page.getByText(/Unmatched Route|Application error:|This page could not be found/).first(),
  ).not.toBeVisible();
}

export function customerSearch(page: Page, surface: Surface) {
  return page.getByPlaceholder(
    surface === 'react' ? 'Search by name, phone, or GSTIN...' : 'Search name, phone, email or GSTIN',
  );
}

export async function createCustomer(page: Page, surface: Surface, name: string) {
  if (surface === 'react') await page.getByRole('button', { name: 'Add customer', exact: true }).click();
  else await page.getByText('Add', { exact: true }).click();
  await page.getByLabel(surface === 'react' ? 'Full Name *' : 'Name *', { exact: true }).fill(name);
  await page
    .getByLabel(surface === 'react' ? 'Mobile Number *' : 'Phone (optional)', { exact: true })
    .fill(`9${Date.now().toString().slice(-9)}`);
  if (surface === 'react') await page.getByRole('button', { name: 'Add Customer', exact: true }).click();
  else await page.getByText('Save contact', { exact: true }).click();
  await customerSearch(page, surface).fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

// Playwright accepts indexedDB:true but its public return type omits the optional
// IndexedDB fields. Keep that serialization detail in one typed helper.
export async function databaseStores(context: import('@playwright/test').BrowserContext) {
  const snapshot = await context.storageState({ indexedDB: true });
  type Snapshot = { origins: { indexedDB?: { stores: { name: string; records: unknown[] }[] }[] }[] };
  return (snapshot as unknown as Snapshot).origins
    .flatMap((origin) => origin.indexedDB ?? [])
    .flatMap((db) => db.stores);
}
