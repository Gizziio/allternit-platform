import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';

const EMAIL = 'cartlidge.joseph@yahoo.com';
const PASSWORD = 'Tyhvix-gafho2-bofxog';
const ORIGIN = 'https://platform.allternit.com';
const OUT_DIR = '/tmp/platform-screens';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function signIn() {
  await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input[name="identifier"], input[name="emailAddress"]', { state: 'visible', timeout: 30000 });
  await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.waitForSelector('input[name="password"]', { state: 'visible', timeout: 30000 });
  await page.getByRole('textbox', { name: 'Password' }).first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.waitForURL(`${ORIGIN}/`, { timeout: 30000 });
  await page.waitForTimeout(2000);
}

await signIn();

await page.screenshot({ path: `${OUT_DIR}/dashboard.png`, fullPage: false });
console.log('dashboard screenshot saved');

await page.goto(`${ORIGIN}/organizations`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/organizations.png`, fullPage: false });
console.log('organizations screenshot saved');

await page.goto(`${ORIGIN}/compute`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/compute.png`, fullPage: false });
console.log('compute screenshot saved');

await page.goto(`${ORIGIN}/billing`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/billing.png`, fullPage: false });
console.log('billing screenshot saved');

await page.goto(`${ORIGIN}/api-keys`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/api-keys.png`, fullPage: false });
console.log('api-keys screenshot saved');

await browser.close();
console.log('all screenshots in', OUT_DIR);
