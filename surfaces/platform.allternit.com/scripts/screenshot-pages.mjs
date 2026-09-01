#!/usr/bin/env node
/**
 * Capture signed-in screenshots of platform.allternit.com console pages.
 *
 * Environment:
 *   CLERK_TEST_EMAIL      - test account email
 *   CLERK_TEST_PASSWORD   - test account password
 *   CLERK_TARGET_ORIGIN   - default https://platform.allternit.com
 *   SCREENSHOT_DIR        - output directory (default ./screenshots)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const ORIGIN = (process.env.CLERK_TARGET_ORIGIN || 'https://platform.allternit.com').replace(/\/$/, '');
const EMAIL = process.env.CLERK_TEST_EMAIL || 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD || '';
const SCREENSHOT_DIR = resolve(process.env.SCREENSHOT_DIR || './screenshots');

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

async function waitForLoad(page) {
  // Wait for either skeletons to disappear or an empty-state/content heading to appear.
  await page.waitForFunction(
    () => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      const hasContent =
        document.body.innerText.includes('Current cost') ||
        document.body.innerText.includes('No paired devices') ||
        document.body.innerText.includes('Paired devices') ||
        document.body.innerText.includes('No API keys yet') ||
        document.body.innerText.includes('Usage unavailable') ||
        document.body.innerText.includes('Billing details unavailable');
      return skeletons.length === 0 || hasContent;
    },
    { timeout: 15000 }
  );
  await page.waitForTimeout(500);
}

async function screenshot(page, path, filename) {
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForLoad(page);
  const file = resolve(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await screenshotSignIn(page);

await signIn(page);

const pages = [
  { path: '/', name: 'dashboard.png' },
  { path: '/devices', name: 'devices.png' },
  { path: '/billing', name: 'billing.png' },
  { path: '/api-keys', name: 'api-keys.png' },
  { path: '/compute', name: 'compute.png' },
  { path: '/organizations', name: 'organizations.png' },
];

async function screenshotSignIn(page) {
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2500);
  const file = resolve(SCREENSHOT_DIR, 'sign-in.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
}

for (const { path, name } of pages) {
  await screenshot(page, path, name);
}

await browser.close();
console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
