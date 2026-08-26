import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'services', 'remote-control-push', 'evidence', 'dashboard');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => logs.push(`requestfailed: ${req.url()} ${req.failure()?.errorText || ''}`));

const url = 'https://remotecontrol.allternit.com/sign-in';
console.log(`Navigating to ${url} ...`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

try {
  const input = page.locator('input[type="email"], input[placeholder*="email" i], input[name="identifier"]').first();
  await input.waitFor({ timeout: 10000 });
  await input.fill('seed@allternit.dev');
  console.log('Filled seed email');
  const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
  await continueBtn.click();
  console.log('Clicked continue');
  await page.waitForTimeout(3000);

  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await passwordInput.fill('rogtem-najXab-rizne7');
    console.log('Filled password');
    await continueBtn.click();
    await page.waitForTimeout(5000);
  }
} catch (err) {
  console.log('Sign-in interaction error:', err.message);
}

const token = await page.evaluate(() => {
  try {
    const key = Object.keys(localStorage).find((k) => k.includes('__clerk'));
    return key ? localStorage.getItem(key) : null;
  } catch { return null; }
});
console.log('Clerk localStorage key present:', !!token);

const screenshotPath = join(outDir, 'remotecontrol-seed-signin.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log('Screenshot:', screenshotPath);

console.log('--- console logs ---');
console.log(logs.slice(0, 100).join('\n'));
console.log('--- end logs ---');

await context.close();
await browser.close();
console.log('Video saved to', outDir);
