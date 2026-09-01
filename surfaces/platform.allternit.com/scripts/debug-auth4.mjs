import { chromium } from 'playwright';
const ORIGIN = 'https://platform.allternit.com';
const EMAIL = 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD;
if (!PASSWORD) throw new Error('CLERK_TEST_PASSWORD required');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let authOk = false;
page.on('request', req => {
  if (req.url().includes('api.allternit.com')) {
    const auth = req.headers()['authorization'] || 'MISSING';
    console.log('API REQUEST:', req.method(), req.url().split('?')[0]);
    console.log('  Authorization:', auth.slice(0, 60) + (auth.length > 60 ? '...' : ''));
    if (auth.startsWith('Bearer ')) authOk = true;
  }
});
page.on('response', async res => {
  if (res.url().includes('api.allternit.com')) {
    const body = await res.text().catch(() => '');
    console.log('API RESPONSE:', res.status(), res.url().split('?')[0], body.slice(0, 120));
  }
});
await page.goto(`${ORIGIN}/sign-in?redirect_url=${encodeURIComponent(`${ORIGIN}/`)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);
await page.getByRole('textbox', { name: 'Email address' }).first().fill(EMAIL);
await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
await page.locator('input[name=password]').first().waitFor({ state: 'visible', timeout: 20000 });
await page.getByRole('textbox', { name: 'Password' }).first().fill(PASSWORD);
await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
await page.waitForURL(`${ORIGIN}/`, { timeout: 30000 });
await page.waitForTimeout(2000);
await page.goto(`${ORIGIN}/runs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
console.log('AUTH OK:', authOk);
await browser.close();
