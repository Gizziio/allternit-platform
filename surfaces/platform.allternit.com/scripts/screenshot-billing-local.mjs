#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://localhost:3016';
const SCREENSHOT_DIR = resolve(SCRIPT_DIR, '../screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(theme) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${ORIGIN}/billing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('allternit-platform-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(
    () => document.body.innerText.includes('Manage Subscription'),
    { timeout: 30000 }
  );
  await page.waitForTimeout(1200);

  const file = resolve(SCREENSHOT_DIR, `billing-local-${theme}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);

  await browser.close();
}

await screenshot('dark');
await screenshot('light');
