import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const manifestPath = 'e2e/.auth/release-tenant.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.status !== 'created' || !manifest.registration.companyName.startsWith('POS E2E '))
  throw new Error('Dedicated E2E registration required');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto('https://pos.indyzai.com/en');
  await page.getByText('Restoring session', { exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL(/auth\.indyzai\.com/, { timeout: 30000 });
  await page.getByRole('textbox', { name: /Email or mobile number/ }).fill(manifest.registration.email);
  await page.getByLabel(/^Password/).fill(manifest.registration.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  // Poll just the URL so failed assertions never include a credential-bearing form snapshot.
  await expect.poll(() => new URL(page.url()).hostname, { timeout: 45000 }).toBe('pos.indyzai.com');
  await page.getByText('Restoring session', { exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('auth_selected_tenant')), {
      timeout: 30000,
      message: 'E2E tenant selection completes',
    })
    .toBe(manifest.tenantId);
  const tenant = await page.evaluate(() => localStorage.getItem('auth_selected_tenant'));
  if (tenant !== manifest.tenantId) {
    console.log('Tenant selection required:', (await page.locator('body').innerText()).slice(0, 3000));
    throw new Error('Select the dedicated E2E tenant before capturing React state');
  }
  await context.storageState({ path: 'e2e/.auth/react.json', indexedDB: true });
  manifest.reactSession = { baseURL: 'https://pos.indyzai.com', capturedAt: new Date().toISOString() };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  console.log('Captured React release E2E session');
} catch (error) {
  // Playwright locator errors may embed form values. Expose only a sanitized error label.
  console.error('React E2E session capture failed:', error.name);
  process.exitCode = 1;
} finally {
  await browser.close();
}
