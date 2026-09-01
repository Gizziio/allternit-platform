#!/usr/bin/env node
/**
 * Capture signed-in screenshots of platform.allternit.com console pages.
 *
 * Environment:
 *   CLERK_TEST_EMAIL      - test account email
 *   CLERK_TEST_PASSWORD   - test account password (required)
 *   CLERK_TARGET_ORIGIN   - default https://platform.allternit.com
 *   SCREENSHOT_DIR        - output directory (default ./screenshots next to this script)
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

async function signIn(page) {
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.locator('input[name=password]').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('textbox', { name: 'Password' }).first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.waitForURL(`${ORIGIN}/`, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

/**
 * Wait until the page shows one of the expected content markers or a known
 * error/timeout message. This avoids capturing skeleton states on pages whose
 * static chrome always contains words like "Devices" or "Billing".
 */
async function waitForPageContent(page, expectedTexts, timeoutMs = 30000) {
  const lowerExpected = expectedTexts.map((t) => t.toLowerCase());
  await page.waitForFunction(
    (markers) => {
      const body = document.body.innerText.toLowerCase();
      return markers.some((m) => body.includes(m));
    },
    lowerExpected,
    { timeout: timeoutMs }
  );
  await page.waitForTimeout(500);
}

async function screenshot(page, path, filename, expectedTexts) {
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForPageContent(page, expectedTexts);
  const file = resolve(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Sign-out landing page
await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForTimeout(2500);
let file = resolve(SCREENSHOT_DIR, 'sign-in.png');
await page.screenshot({ path: file, fullPage: false });
console.log(`✓ ${file}`);

await signIn(page);

const pages = [
  {
    path: '/',
    name: 'dashboard.png',
    expected: ['Cloud usage trend', 'Request timed out', 'Unable to load usage', 'Welcome back'],
  },
  {
    path: '/devices',
    name: 'devices.png',
    expected: ['No paired devices', 'Devices unavailable', 'Request timed out', 'Unable to load devices'],
  },
  {
    path: '/billing',
    name: 'billing.png',
    expected: ['Monthly runtime usage', 'Billing details unavailable', 'Request timed out'],
  },
  {
    path: '/api-keys',
    name: 'api-keys.png',
    expected: ['No API keys yet', 'Unable to load API keys', 'Production compute agent'],
  },
  {
    path: '/compute',
    name: 'compute.png',
    expected: ['Unable to load hosted compute', 'Request timed out', 'No hosted runtimes'],
  },
  {
    path: '/organizations',
    name: 'organizations.png',
    expected: ['Members', 'Cloud accounts', 'Failed to create organization', 'Request timed out'],
  },
];

for (const { path, name, expected } of pages) {
  await screenshot(page, path, name, expected);
}

await browser.close();
console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
