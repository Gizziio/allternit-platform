#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://localhost:3016';
const SCREENSHOT_DIR = resolve(SCRIPT_DIR, '../screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const PAGES = [
  { path: '/', name: 'portal-landing' },
  { path: '/models', name: 'portal-models' },
  { path: '/billing', name: 'portal-billing' },
];

async function screenshot(page, theme, path, name) {
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('allternit-platform-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const file = resolve(SCREENSHOT_DIR, `${name}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
}

const browser = await chromium.launch({ headless: true });

for (const { path, name } of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await screenshot(page, 'dark', path, name);
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await screenshot(page2, 'light', path, name);
  await ctx2.close();
}

await browser.close();
console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
