#!/usr/bin/env node
/**
 * End-to-end smoke test for the hosted Clerk sign-in / sign-up pages.
 *
 * Environment variables:
 *   CLERK_TEST_EMAIL        - real verified account email (default: cartlidge.joseph@yahoo.com)
 *   CLERK_TEST_PASSWORD     - account password (required)
 *   CLERK_SECONDARY_EMAIL   - optional second verified account to prove the full lifecycle
 *   CLERK_SECONDARY_PASSWORD- password for the secondary account
 *   CLERK_TARGET_ORIGIN     - origin under test (default: https://platform.allternit.com)
 *   HEADLESS                - set to "0" to watch the browser
 *
 * The test launches fresh browser contexts, signs in with the primary (and
 * optional secondary) account, and verifies the sign-up page can submit a new
 * registration to Clerk. We stop the sign-up flow at the verification step
 * because a headless browser cannot access the mailbox; the real accounts are
 * the development/test targets.
 */
import { chromium } from '@playwright/test';
import { randomBytes } from 'crypto';

const ORIGIN = (process.env.CLERK_TARGET_ORIGIN || 'https://platform.allternit.com').replace(/\/$/, '');
const EMAIL = process.env.CLERK_TEST_EMAIL || 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD || '';
const SECONDARY_EMAIL = process.env.CLERK_SECONDARY_EMAIL || '';
const SECONDARY_PASSWORD = process.env.CLERK_SECONDARY_PASSWORD || PASSWORD;
const HEADLESS = process.env.HEADLESS !== '0';

function fail(message) {
  console.error('❌', message);
  process.exit(1);
}

function logPageEvents(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => console.log('[browser pageerror]', err.message));
}

async function waitForClerkForm(page) {
  // Clerk renders asynchronously; wait for a known form field. The sign-in page
  // shows identifier+password together, the sign-up page shows email+password.
  await page.waitForSelector(
    'input[name="identifier"], input[name="emailAddress"], input[name="password"]',
    { timeout: 20000 }
  );
  // Give the component a beat to settle event handlers.
  await page.waitForTimeout(300);
}

async function signIn(page, email, password) {
  const signInUrl = `${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/shell`)}`;
  console.log('→ sign-in:', email, signInUrl);
  await page.goto(signInUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForClerkForm(page);

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.waitForURL(`${ORIGIN}/shell`, { timeout: 30000 });
  console.log('✅ signed in and redirected to', page.url());
}

async function checkSignUpForm(page) {
  logPageEvents(page);

  const signUpUrl = `${ORIGIN}/sign-up?redirect_url=${encodeURIComponent(`${ORIGIN}/shell`)}`;
  console.log('→ sign-up:', signUpUrl);
  await page.goto(signUpUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForClerkForm(page);

  await page.locator('input[name="firstName"]').waitFor();
  await page.locator('input[name="lastName"]').waitFor();
  await page.locator('input[name="emailAddress"]').waitFor();
  await page.locator('input[name="password"]').waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  console.log('✅ sign-up form renders');

  const uniqueEmail = `cartlidge.joseph+clerk-e2e-${Date.now()}-${randomBytes(2).toString('hex')}@yahoo.com`;
  await page.locator('input[name="firstName"]').fill('E2E');
  await page.locator('input[name="lastName"]').fill('Bot');
  await page.locator('input[name="emailAddress"]').fill(uniqueEmail);
  await page.locator('input[name="password"]').fill('Tyhvix-gafho2-bofxog');

  // Intercept the sign-up API call so we can assert the form actually reached
  // Clerk without depending on the verification mailbox. Reading the response
  // body after Clerk reloads the component fails, so we route it and capture
  // the body before the browser sees it.
  let signUpBody = null;
  let signUpStatus = null;
  await page.route('**/v1/client/sign_ups?*', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    signUpStatus = response.status();
    signUpBody = await response.json().catch(() => null);
    await route.fulfill({
      status: signUpStatus,
      contentType: response.headers()['content-type'] || 'application/json',
      body: JSON.stringify(signUpBody),
    });
  });

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Wait for the sign-up API call to finish.
  await page.waitForResponse(
    (res) => res.url().includes('/v1/client/sign_ups?') && res.request().method() === 'POST',
    { timeout: 20000 }
  );

  if (signUpStatus !== 200 || !signUpBody) {
    throw new Error(`sign-ups API did not return a capturable 200 response (status=${signUpStatus})`);
  }
  if (signUpBody.response?.status !== 'missing_requirements') {
    throw new Error(`unexpected sign-up status: ${JSON.stringify(signUpBody.response?.status)}`);
  }
  if (!signUpBody.response?.unverified_fields?.includes('email_address')) {
    throw new Error(`email_address was not marked unverified: ${JSON.stringify(signUpBody.response?.unverified_fields)}`);
  }
  console.log('✅ sign-up form submitted to Clerk; verification email would be sent to', uniqueEmail);
}

(async () => {
  if (!PASSWORD) {
    fail('CLERK_TEST_PASSWORD is required');
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  let exitCode = 0;

  try {
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page1 = await ctx1.newPage();
    await signIn(page1, EMAIL, PASSWORD);
    await ctx1.close();

    if (SECONDARY_EMAIL) {
      const ctx1b = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page1b = await ctx1b.newPage();
      await signIn(page1b, SECONDARY_EMAIL, SECONDARY_PASSWORD);
      await ctx1b.close();
    }

    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await ctx2.newPage();
    await checkSignUpForm(page2);
    await ctx2.close();

    console.log('\n🎉 Clerk e2e smoke passed');
  } catch (err) {
    console.error('\n❌ Clerk e2e smoke failed:', err);
    exitCode = 1;
  } finally {
    await browser.close();
  }

  process.exit(exitCode);
})();
