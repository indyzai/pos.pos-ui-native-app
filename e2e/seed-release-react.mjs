import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const path = 'e2e/.auth/release-tenant.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
const baseURL = 'https://pos.indyzai.com';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ storageState: 'e2e/.auth/react.json' });
  const page = await context.newPage();
  await page.goto(`${baseURL}/customers`);
  await expect(page.getByPlaceholder('Search by name, phone, or GSTIN...')).toBeVisible();
  const tenant = await page.evaluate(() => localStorage.getItem('auth_selected_tenant'));
  if (tenant !== manifest.tenantId) throw new Error('Wrong E2E tenant');
  const search = page.getByPlaceholder('Search by name, phone, or GSTIN...');
  await search.fill('E2E Cached Customer');
  // Wait for loading to finish before deciding whether to create the seed.
  await expect(page.getByText(/Loading customers/i)).not.toBeVisible();
  if (!(await page.getByText('E2E Cached Customer', { exact: true }).count())) {
    await page.getByRole('button', { name: 'Add customer', exact: true }).click();
    await page.getByLabel('Full Name *', { exact: true }).fill('E2E Cached Customer');
    await page.getByLabel('Mobile Number *', { exact: true }).fill('9000000001');
    await page.getByRole('button', { name: 'Add Customer', exact: true }).click();
  }
  await expect(page.getByText('E2E Cached Customer', { exact: true }).first()).toBeVisible();
  await context.storageState({ path: 'e2e/.auth/react.json', indexedDB: true });
  manifest.seed.customer = { name: 'E2E Cached Customer' };
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  console.log('Seeded and cached E2E customer in dedicated release tenant');
} finally {
  await browser.close();
}
