#!/usr/bin/env node
/**
 * Production stress test for the hosted Clerk sign-in / sign-up flow.
 *
 * Tests both the product shell (ai.allternit.com -> /shell) and the new
 * cloud console (platform.allternit.com -> /). Session cookies are shared
 * across .allternit.com subdomains, so cross-origin tests are included.
 *
 * Environment variables:
 *   CLERK_TARGET_ORIGIN   - primary origin under test (default: https://platform.allternit.com)
 *   CLERK_SECONDARY_ORIGIN- secondary origin for cross-subdomain tests (default: https://ai.allternit.com)
 *   CLERK_TEST_EMAIL      - real verified account email (default: cartlidge.joseph@yahoo.com)
 *   CLERK_TEST_PASSWORD   - account password (required)
 *   HEADLESS              - set to "0" to watch the browser (default: headless)
 *
 * Run:
 *   CLERK_TEST_PASSWORD='...' node scripts/clerk-stress-test-v4.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { randomBytes } from 'crypto';

// Load gitignored .env.local so other agents can run the suite without passing
// credentials on the command line.
config({ path: resolve(fileURLToPath(new URL('.', import.meta.url)), '../.env.local') });

const PLATFORM_ORIGIN = (process.env.CLERK_TARGET_ORIGIN || 'https://platform.allternit.com').replace(/\/$/, '');
const AI_ORIGIN = (process.env.CLERK_SECONDARY_ORIGIN || 'https://ai.allternit.com').replace(/\/$/, '');
const EMAIL = process.env.CLERK_TEST_EMAIL || 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD || '';

if (!PASSWORD) {
  console.error('❌ CLERK_TEST_PASSWORD is required');
  process.exit(1);
}

const results = [];
function pass(test) { results.push({ test, ok: true }); console.log('✅', test); }
function fail(test, err) { results.push({ test, ok: false, error: err.message }); console.log('❌', test, err.message); }

function homePath(origin) {
  // The cloud console post-auth landing page is /; the product shell is /shell.
  return origin === AI_ORIGIN ? '/shell' : '/';
}

function homeUrl(origin) {
  return `${origin}${homePath(origin)}`;
}

function signInUrl(origin) {
  return `${origin}/sign-in?redirect_url=${encodeURIComponent(homeUrl(origin))}`;
}

function signUpUrl(origin) {
  return `${origin}/sign-up?redirect_url=${encodeURIComponent(homeUrl(origin))}`;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
}

async function waitForClerkForm(page) {
  await page.waitForSelector(
    'input[name="identifier"], input[name="emailAddress"], input[name="password"]',
    { timeout: 20000 }
  );
  await page.waitForTimeout(300);
}

async function signIn(page, origin, email, password) {
  await goto(page, signInUrl(origin));
  await waitForClerkForm(page);
  await page.getByRole('textbox', { name: 'Email address' }).first().fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.locator('input[name=password]').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('textbox', { name: 'Password' }).first().fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.waitForURL(homeUrl(origin), { timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function signOut(page) {
  // Works for both the product shell (UserButton avatar) and the console header.
  const trigger = page.locator('.cl-userButtonTrigger, button[aria-label*="user" i]').first();
  if (await trigger.count() > 0) {
    await trigger.click();
  } else {
    await page.locator('text=Account').first().click();
  }
  await page.waitForTimeout(800);
  for (const sel of ['text=Sign out', 'text=Sign Out']) {
    if (await page.locator(sel).count() > 0) {
      await page.locator(sel).first().click();
      break;
    }
  }
  await page.waitForTimeout(3000);
}

async function hasClerkError(page) {
  const selectors = [
    '.cl-formFieldErrorText',
    '.cl-formFieldErrorTextBox',
    '.cl-alertText',
    '.cl-alert',
    '[role="alert"]',
    'text=Password is incorrect',
    'text=Incorrect',
    'text=invalid',
    'text=not found',
  ];
  for (const sel of selectors) {
    try {
      if (await page.locator(sel).count() > 0) return true;
    } catch {}
  }
  return false;
}

const HEADLESS = process.env.HEADLESS !== '0';

const browser = await chromium.launch({ headless: HEADLESS });

// Test 1: Normal sign-in on primary origin
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try { await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD); pass('Normal sign-in lands on console dashboard'); }
  catch (e) { fail('Normal sign-in lands on console dashboard', e); }
  await ctx.close();
}

// Test 2: Wrong password
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.locator('input[name=password]').first().waitFor({ state: 'visible' });
    await page.getByRole('textbox', { name: 'Password' }).first().fill('wrong-password-12345');
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForTimeout(4000);
    if (!page.url().includes('/sign-in')) throw new Error(`Expected /sign-in, got ${page.url()}`);
    if (!(await hasClerkError(page))) throw new Error('No Clerk error visible');
    pass('Wrong password shows error and stays on sign-in');
  } catch (e) { fail('Wrong password shows error and stays on sign-in', e); }
  await ctx.close();
}

// Test 3: Non-existent email proceeds to password (no enumeration)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    await page.getByRole('textbox', { name: 'Email address' }).first().fill('doesnotexist-12345@yahoo.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForTimeout(3000);
    if (!page.url().includes('/sign-in')) throw new Error(`Expected /sign-in, got ${page.url()}`);
    const hasPassword = await page.locator('input[name=password]').count() > 0;
    if (!hasPassword) throw new Error('Did not proceed to password step');
    pass('Non-existent email proceeds to password step (no enumeration leak)');
  } catch (e) { fail('Non-existent email proceeds to password step (no enumeration leak)', e); }
  await ctx.close();
}

// Test 4: Sign out then sign back in
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await signOut(page);
    if (!page.url().includes('/sign-in')) throw new Error(`Expected /sign-in, got ${page.url()}`);
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    pass('Sign out then sign back in works');
  } catch (e) { fail('Sign out then sign back in works', e); }
  await ctx.close();
}

// Test 5: Direct dashboard while signed out redirects to /sign-in
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, homeUrl(PLATFORM_ORIGIN));
    if (!page.url().includes('/sign-in')) throw new Error(`Expected /sign-in, got ${page.url()}`);
    pass('Direct dashboard while signed out redirects to /sign-in');
  } catch (e) { fail('Direct dashboard while signed out redirects to /sign-in', e); }
  await ctx.close();
}

// Test 6: Direct /sign-in while signed in redirects to dashboard
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    if (!page.url().includes(homePath(PLATFORM_ORIGIN))) throw new Error(`Expected ${homePath(PLATFORM_ORIGIN)}, got ${page.url()}`);
    pass('Direct /sign-in while signed in redirects to dashboard');
  } catch (e) { fail('Direct /sign-in while signed in redirects to dashboard', e); }
  await ctx.close();
}

// Test 7: Session persists after closing and reopening page
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await page.close();
    const page2 = await ctx.newPage();
    await goto(page2, homeUrl(PLATFORM_ORIGIN));
    if (page2.url().includes('/sign-in')) throw new Error('Session lost');
    pass('Session persists after closing and reopening page');
  } catch (e) { fail('Session persists after closing and reopening page', e); }
  await ctx.close();
}

// Test 8: Multiple sign-in/sign-out cycles
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    for (let i = 0; i < 3; i++) {
      await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
      await signOut(page);
    }
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    pass('Multiple sign-in/sign-out cycles work');
  } catch (e) { fail('Multiple sign-in/sign-out cycles work', e); }
  await ctx.close();
}

// Test 9: Service worker excludes /__clerk/ (only if a SW is registered)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    // getRegistration() returns undefined immediately when no SW is registered;
    // ready waits forever, so avoid it.
    const reg = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return null;
      return navigator.serviceWorker.getRegistration();
    });
    if (!reg) {
      pass('Service worker skip test — none registered on console');
    } else {
      const swUrl = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.scriptURL;
      });
      if (!swUrl) {
        pass('Service worker skip test — no active worker');
      } else {
        const swText = await (await fetch(swUrl)).text();
        if (!swText.includes('/__clerk/')) throw new Error('SW does not skip /__clerk/');
        pass('Service worker excludes /__clerk/ requests');
      }
    }
  } catch (e) { fail('Service worker excludes /__clerk/ requests', e); }
  await ctx.close();
}

// Test 10: Refresh during sign-in (factor-one step)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.locator('input[name=password]').first().waitFor({ state: 'visible' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    if (await page.locator('input[name=identifier]').count() > 0) {
      await page.locator('input[name=identifier]').first().fill(EMAIL);
      await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
      await page.locator('input[name=password]').first().waitFor({ state: 'visible' });
    }
    await page.locator('input[name=password]').first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForURL(homeUrl(PLATFORM_ORIGIN), { timeout: 30000 });
    pass('User can recover sign-in after refreshing at password step');
  } catch (e) { fail('User can recover sign-in after refreshing at password step', e); }
  await ctx.close();
}

// Test 11: Back button from dashboard behaves safely
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await page.goBack();
    await page.waitForTimeout(3000);
    if (!page.url().includes(homePath(PLATFORM_ORIGIN)) && !page.url().includes('/sign-in')) {
      throw new Error(`Unexpected URL after back: ${page.url()}`);
    }
    pass('Back button from dashboard behaves safely');
  } catch (e) { fail('Back button from dashboard behaves safely', e); }
  await ctx.close();
}

// Test 12: Concurrent fresh-context sign-in
{
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page1 = await ctx1.newPage();
  await signIn(page1, PLATFORM_ORIGIN, EMAIL, PASSWORD);

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  try {
    await signIn(page2, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    pass('Concurrent fresh-context sign-in works');
  } catch (e) { fail('Concurrent fresh-context sign-in works', e); }
  await ctx1.close();
  await ctx2.close();
}

// Test 13: Sign-up form renders and submits to Clerk
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signUpUrl(PLATFORM_ORIGIN));
    await page.locator('input[name="firstName"]').waitFor({ timeout: 20000 });
    await page.locator('input[name="lastName"]').waitFor({ timeout: 20000 });
    await page.locator('input[name="emailAddress"]').waitFor({ timeout: 20000 });
    await page.locator('input[name="password"]').waitFor({ timeout: 20000 });

    const uniqueEmail = `cartlidge.joseph+clerk-e2e-${Date.now()}-${randomBytes(2).toString('hex')}@yahoo.com`;
    await page.locator('input[name="firstName"]').fill('E2E');
    await page.locator('input[name="lastName"]').fill('Bot');
    await page.locator('input[name="emailAddress"]').fill(uniqueEmail);
    await page.locator('input[name="password"]').fill('Tyhvix-gafho2-bofxog');

    let signUpStatus = null;
    let signUpBody = null;
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

    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForResponse(
      (res) => res.url().includes('/v1/client/sign_ups?') && res.request().method() === 'POST',
      { timeout: 20000 }
    );

    if (signUpStatus !== 200 || !signUpBody) {
      throw new Error(`sign-ups API did not return 200 (status=${signUpStatus})`);
    }
    if (signUpBody.response?.status !== 'missing_requirements') {
      throw new Error(`unexpected sign-up status: ${JSON.stringify(signUpBody.response?.status)}`);
    }
    if (!signUpBody.response?.unverified_fields?.includes('email_address')) {
      throw new Error(`email_address was not marked unverified: ${JSON.stringify(signUpBody.response?.unverified_fields)}`);
    }
    pass('Sign-up form renders and submits to Clerk');
  } catch (e) { fail('Sign-up form renders and submits to Clerk', e); }
  await ctx.close();
}

// Test 14: GitHub OAuth button initiates OAuth redirect
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signInUrl(PLATFORM_ORIGIN));
    const githubButton = page.locator('button:has-text("Continue with GitHub")').first();
    await githubButton.waitFor({ state: 'visible', timeout: 20000 });

    // Intercept navigation to GitHub and cancel it so the test doesn't leave the page.
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      githubButton.click(),
    ]);

    let oauthUrl = null;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 15000 });
      oauthUrl = popup.url();
      await popup.close();
    } else {
      // Some flows navigate the same page; wait for URL change.
      await page.waitForTimeout(5000);
      oauthUrl = page.url();
    }

    if (!oauthUrl || (!oauthUrl.startsWith('https://github.com/login') && !oauthUrl.startsWith('https://github.com/signup'))) {
      throw new Error(`GitHub OAuth did not redirect to github.com: ${oauthUrl}`);
    }
    pass('GitHub OAuth button initiates OAuth redirect');
  } catch (e) { fail('GitHub OAuth button initiates OAuth redirect', e); }
  await ctx.close();
}

// Test 15: ai.allternit.com subdomain sign-in works
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, AI_ORIGIN, EMAIL, PASSWORD);
    pass('Sign-in works on ai.allternit.com subdomain');
  } catch (e) { fail('Sign-in works on ai.allternit.com subdomain', e); }
  await ctx.close();
}

// Test 16: Malicious cross-origin redirect is rejected
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    const maliciousUrl = `${PLATFORM_ORIGIN}/sign-in?redirect_url=https%3A%2F%2Fevil.com%2Fshell`;
    await goto(page, maliciousUrl);
    await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.locator('input[name=password]').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('input[name=password]').first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForTimeout(5000);
    const url = page.url();
    if (url.includes('evil.com')) throw new Error(`Redirected to malicious origin: ${url}`);
    if (!url.includes(homePath(PLATFORM_ORIGIN))) throw new Error(`Did not land on dashboard: ${url}`);
    pass('Malicious cross-origin redirect is rejected');
  } catch (e) { fail('Malicious cross-origin redirect is rejected', e); }
  await ctx.close();
}

// Test 17: Session shared across subdomains (platform -> ai)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    // Now visit ai.allternit.com/shell in same context and expect not to hit sign-in.
    await goto(page, homeUrl(AI_ORIGIN));
    if (page.url().includes('/sign-in')) throw new Error('Session not shared with ai.allternit.com');
    pass('Session shared across platform and ai subdomains');
  } catch (e) { fail('Session shared across platform and ai subdomains', e); }
  await ctx.close();
}

// Test 18: Session is shared across multiple tabs in the same context
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    const page2 = await ctx.newPage();
    await goto(page2, homeUrl(PLATFORM_ORIGIN));
    if (page2.url().includes('/sign-in')) throw new Error('New tab did not share session');
    pass('Session shared across multiple tabs');
  } catch (e) { fail('Session shared across multiple tabs', e); }
  await ctx.close();
}

// Test 19: Sign-up with an already-registered email shows an error
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await goto(page, signUpUrl(PLATFORM_ORIGIN));
    await page.locator('input[name="firstName"]').waitFor({ timeout: 20000 });
    await page.locator('input[name="firstName"]').fill('E2E');
    await page.locator('input[name="lastName"]').fill('Bot');
    await page.locator('input[name="emailAddress"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill('Tyhvix-gafho2-bofxog');
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await page.waitForTimeout(4000);
    if (!(await hasClerkError(page))) throw new Error('Expected Clerk error for duplicate email');
    pass('Sign-up with existing email shows error');
  } catch (e) { fail('Sign-up with existing email shows error', e); }
  await ctx.close();
}

// Test 20: Session survives localStorage clear (cookies carry auth)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    if (page.url().includes('/sign-in')) throw new Error('Session lost after clearing localStorage');
    pass('Session survives localStorage clear');
  } catch (e) { fail('Session survives localStorage clear', e); }
  await ctx.close();
}

// Test 21: Long-lived session stays authenticated after Clerk token refresh interval
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    // The app refreshes Clerk JWT every 50s; wait 70s to force at least one refresh.
    await page.waitForTimeout(70000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    if (page.url().includes('/sign-in')) throw new Error('Session lost after token refresh window');
    pass('Long-lived session stays authenticated after token refresh window');
  } catch (e) { fail('Long-lived session stays authenticated after token refresh window', e); }
  await ctx.close();
}

// Test 22: Console dashboard renders after sign-in
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, PLATFORM_ORIGIN, EMAIL, PASSWORD);
    await page.waitForSelector('text=Platform Console', { timeout: 10000 });
    pass('Console dashboard renders after sign-in');
  } catch (e) { fail('Console dashboard renders after sign-in', e); }
  await ctx.close();
}

await browser.close();

console.log('\n=== RESULTS ===');
for (const r of results) console.log(r.ok ? '✅' : '❌', r.test);
const failed = results.filter(r => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} test(s) failed:`);
  for (const f of failed) console.log(' -', f.test, ':', f.error);
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
