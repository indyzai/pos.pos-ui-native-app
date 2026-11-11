import { test, expect } from '@playwright/test';
import { appURL, surfaceOf } from '../support/app';

test('native login masks passwords and allows visibility toggle', async ({ page, baseURL }, info) => {
  test.skip(surfaceOf(info) === 'react', 'React uses the external authentication service');
  await page.goto(appURL(baseURL!, '/login'));
  await expect(page.getByLabel('Email or mobile number', { exact: true })).toBeVisible();
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('playwright-placeholder');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByLabel('Show password', { exact: true }).click();
  await expect(password).toHaveJSProperty('type', 'text');
  await page.getByLabel('Hide password', { exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('anonymous native deep links redirect to login', async ({ page, baseURL }, info) => {
  test.skip(surfaceOf(info) === 'react', 'React authentication redirects to an external identity service');
  await page.goto(appURL(baseURL!, '/inventory'));
  await expect(page).toHaveURL(appURL(baseURL!, '/login'));
  await expect(page.getByLabel('Email or mobile number', { exact: true })).toBeVisible();
});
