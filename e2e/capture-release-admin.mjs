import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const manifestPath = 'e2e/.auth/release-tenant.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.status !== 'created' || !manifest.registration.companyName.startsWith('POS E2E '))
  throw new Error('Dedicated E2E registration required');
const baseURL = process.env.E2E_ADMIN_URL || 'http://localhost:3512';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('requestfailed', (request) =>
    console.log(
      'Request failed:',
      request.method(),
      new URL(request.url()).origin,
      request.failure()?.errorText,
    ),
  );
  await context.addInitScript(() => localStorage.setItem('indyz.admin.api-environment.v1', 'production'));
  await page.goto(`${baseURL}/login`, { timeout: 60000 });
  await page.getByLabel('Email or mobile number', { exact: true }).fill(manifest.registration.email);
  await page.getByLabel('Password', { exact: true }).fill(manifest.registration.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect
    .poll(() => page.url(), { timeout: 30000, message: 'Admin login completed' })
    .toBe(`${baseURL}/reports`);
  await page.goto(`${baseURL}/customers`);
  await expect(page.getByPlaceholder('Search name, phone, email or GSTIN')).toBeVisible({ timeout: 30000 });
  const selectedTenant = await page.evaluate(() => localStorage.getItem('indyzai.admin.selected-tenant'));
  if (selectedTenant !== manifest.tenantId) throw new Error('Admin session selected a different tenant');
  const search = page.getByPlaceholder('Search name, phone, email or GSTIN');
  await search.fill('E2E Cached Customer');
  if (!(await page.getByText('E2E Cached Customer', { exact: true }).count())) {
    await page.getByText('Add', { exact: true }).click();
    await page.getByLabel('Name *', { exact: true }).fill('E2E Cached Customer');
    await page.getByLabel('Phone (optional)', { exact: true }).fill('9000000001');
    await page.getByText('Save contact', { exact: true }).click();
    await expect(page.getByText('E2E Cached Customer', { exact: true }).first()).toBeVisible();
  }
  manifest.seed.customer = { name: 'E2E Cached Customer' };
  await context.storageState({ path: 'e2e/.auth/admin.json', indexedDB: true });
  manifest.adminSession = { baseURL, capturedAt: new Date().toISOString() };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  console.log('Captured Admin E2E session and verified dedicated tenant');
} catch (error) {
  console.error('Admin E2E session capture failed:', error.name);
  process.exitCode = 1;
} finally {
  await browser.close();
}
