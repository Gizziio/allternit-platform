import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const ORIGIN = (process.env.CLERK_TARGET_ORIGIN || 'https://platform.allternit.com').replace(/\/$/, '');
const TEST_EMAIL = process.env.CLERK_TEST_EMAIL || 'cartlidge.joseph@yahoo.com';
const TEST_PASSWORD = process.env.CLERK_TEST_PASSWORD || '';
const SECONDARY_EMAIL = process.env.CLERK_SECONDARY_EMAIL || '';
const SECONDARY_PASSWORD = process.env.CLERK_SECONDARY_PASSWORD || TEST_PASSWORD;

test.describe.configure({ mode: 'serial' });

test.skip(!TEST_PASSWORD, 'CLERK_TEST_PASSWORD is required');

async function waitForClerkForm(page) {
  await page.waitForSelector(
    'input[name="identifier"], input[name="emailAddress"], input[name="password"]',
    { timeout: 20000 }
  );
  await page.waitForTimeout(300);
}

async function signIn(page, email: string, password: string) {
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/shell`)}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await waitForClerkForm(page);
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(`${ORIGIN}/shell`, { timeout: 30000 });
}

test('Clerk sign-in with real account lands on /shell', async ({ page }) => {
  await signIn(page, TEST_EMAIL, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/shell/);
});

test('Clerk secondary account sign-in works end-to-end', async ({ page }) => {
  test.skip(!SECONDARY_EMAIL, 'CLERK_SECONDARY_EMAIL is not set');
  await signIn(page, SECONDARY_EMAIL, SECONDARY_PASSWORD);
  await expect(page).toHaveURL(/\/shell/);
});

test('Clerk sign-up page submits a new registration to Clerk', async ({ page }) => {
  await page.goto(`${ORIGIN}/sign-up?redirect_url=${encodeURIComponent(`${ORIGIN}/shell`)}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await waitForClerkForm(page);

  await expect(page.locator('input[name="firstName"]')).toBeVisible();
  await expect(page.locator('input[name="lastName"]')).toBeVisible();
  await expect(page.locator('input[name="emailAddress"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();

  const uniqueEmail = `cartlidge.joseph+clerk-e2e-${Date.now()}-${randomBytes(2).toString('hex')}@yahoo.com`;
  await page.locator('input[name="firstName"]').fill('E2E');
  await page.locator('input[name="lastName"]').fill('Bot');
  await page.locator('input[name="emailAddress"]').fill(uniqueEmail);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);

  let signUpBody: any = null;
  await page.route('**/v1/client/sign_ups?*', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const status = response.status();
    signUpBody = await response.json().catch(() => null);
    await route.fulfill({
      status,
      contentType: response.headers()['content-type'] || 'application/json',
      body: JSON.stringify(signUpBody),
    });
  });

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForResponse(
    (res) => res.url().includes('/v1/client/sign_ups?') && res.request().method() === 'POST',
    { timeout: 20000 }
  );

  expect(signUpBody).toBeTruthy();
  expect(signUpBody.response?.status).toBe('missing_requirements');
  expect(signUpBody.response?.unverified_fields).toContain('email_address');
});
