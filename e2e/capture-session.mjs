import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';

const surface = process.argv[2];
if (!['react', 'pos', 'admin'].includes(surface))
  throw new Error('Usage: node e2e/capture-session.mjs react|pos|admin');
const baseURL =
  process.env[`E2E_${surface.toUpperCase()}_URL`] ||
  { react: 'http://localhost:3510/en', pos: 'http://localhost:3511', admin: 'http://localhost:3512' }[
    surface
  ];
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const page = await context.newPage();
  await page.goto(baseURL);
  await terminal.question(
    'Sign in to a disposable seeded test tenant, finish device/counter setup, open Customers and wait for data. Press Enter here when ready. ',
  );
  const path = resolve(process.env[`E2E_${surface.toUpperCase()}_STATE`] || `e2e/.auth/${surface}.json`);
  await mkdir(resolve(path, '..'), { recursive: true });
  await context.storageState({ path, indexedDB: true });
  console.log(`Saved test session to ${path}`);
} finally {
  terminal.close();
  await browser.close();
}
