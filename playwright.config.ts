import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = resolve('e2e/.auth/release-tenant.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.seed?.product?.name) process.env.E2E_PRODUCT ||= manifest.seed.product.name;
  if (manifest.seed?.customer?.name) process.env.E2E_CACHED_CUSTOMER ||= manifest.seed.customer.name;
}

export default defineConfig({
  testDir: './e2e/specs',
  testMatch: '**/*.pw.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'react',
      use: { ...devices['Desktop Chrome'], baseURL: process.env.E2E_REACT_URL || 'http://localhost:3510/en' },
      metadata: { surface: 'react' },
    },
    ...(['pos', 'admin'] as const).flatMap((surface) => [
      {
        name: `${surface}-tablet`,
        use: {
          ...devices['Desktop Chrome'],
          viewport: { width: 1280, height: 800 },
          baseURL:
            process.env[`E2E_${surface.toUpperCase()}_URL`] ||
            `http://localhost:${surface === 'pos' ? 3511 : 3512}`,
        },
        metadata: { surface },
      },
      {
        name: `${surface}-phone`,
        use: {
          ...devices['Pixel 7'],
          baseURL:
            process.env[`E2E_${surface.toUpperCase()}_URL`] ||
            `http://localhost:${surface === 'pos' ? 3511 : 3512}`,
        },
        metadata: { surface },
      },
    ]),
  ],
  // Servers are deliberately started separately so one run can target local or staging builds.
  outputDir: resolve('test-results'),
});
