#!/usr/bin/env node
/**
 * Capture platform.allternit.com screenshots for both light and dark themes.
 *
 * Environment:
 *   CLERK_TEST_EMAIL      - test account email
 *   CLERK_TEST_PASSWORD   - test account password (required)
 *   CLERK_TARGET_ORIGIN   - default https://platform.allternit.com
 *   SCREENSHOT_DIR        - output directory (default ./screenshots)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ORIGIN = (process.env.CLERK_TARGET_ORIGIN || 'https://platform.allternit.com').replace(/\/$/, '');
const EMAIL = process.env.CLERK_TEST_EMAIL || 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD || '';
const SCREENSHOT_DIR = resolve(process.env.SCREENSHOT_DIR || resolve(SCRIPT_DIR, '../screenshots'));

if (!PASSWORD) {
  console.error('CLERK_TEST_PASSWORD is required');
  process.exit(1);
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('allternit-platform-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function screenshot(page, filename) {
  const file = resolve(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
}

async function signIn(page) {
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.locator('input[name=password]').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('textbox', { name: 'Password' }).first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.waitForURL(`${ORIGIN}/`, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function waitForDashboard(page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText.toLowerCase();
      return ['welcome back', 'cloud usage trend', 'request timed out', 'unable to load usage'].some((m) =>
        body.includes(m)
      );
    },
    { timeout: 30000 }
  );
  await page.waitForTimeout(500);
}

async function waitForSettings(page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('appearance') && body.includes('account');
    },
    { timeout: 30000 }
  );
  await page.waitForTimeout(500);
}

const browser = await chromium.launch({ headless: true });

// --- Signed-out sign-in page screenshots in each theme ---
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await applyTheme(page, theme);
  await screenshot(page, `sign-in-${theme}.png`);
  await ctx.close();
}

// --- Signed-in console screenshots in each theme ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await signIn(page);

for (const theme of ['dark', 'light']) {
  await applyTheme(page, theme);

  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForDashboard(page);
  await screenshot(page, `dashboard-${theme}.png`);

  await page.goto(`${ORIGIN}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForSettings(page);
  await screenshot(page, `settings-${theme}.png`);
}

await ctx.close();
await browser.close();
console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
