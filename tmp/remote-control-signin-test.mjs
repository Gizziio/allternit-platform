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

// Try to interact with the Clerk sign-in form.
try {
  const input = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  await input.waitFor({ timeout: 10000 });
  await input.fill('test-check@allternit.com');
  console.log('Filled email input');
  const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
  await continueBtn.click();
  console.log('Clicked continue');
  await page.waitForTimeout(5000);
} catch (err) {
  console.log('Could not interact with sign-in form:', err.message);
}

const screenshotPath = join(outDir, 'remotecontrol-signin.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log('Screenshot:', screenshotPath);

console.log('--- console logs ---');
console.log(logs.slice(0, 100).join('\n'));
console.log('--- end logs ---');

await context.close();
await browser.close();
console.log('Video saved to', outDir);
