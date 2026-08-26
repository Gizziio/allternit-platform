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

const url = process.env.TARGET_URL || 'https://remotecontrol.allternit.com/';
console.log(`Navigating to ${url} ...`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);

const screenshotPath = join(outDir, 'remotecontrol-landing.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log('Screenshot:', screenshotPath);

const html = await page.content();
const hasClerkError = logs.some((l) => /platform\.allternit\.com|clerk|origin/i.test(l)) ||
  html.includes('clerk') || html.includes('Production Keys are only allowed');

if (hasClerkError) {
  console.log('Clerk origin/domain issue detected in logs or page.');
} else {
  console.log('No obvious Clerk origin error observed.');
}

console.log('--- console logs ---');
console.log(logs.slice(0, 100).join('\n'));
console.log('--- end logs ---');

await context.close();
await browser.close();
console.log('Video saved to', outDir);
