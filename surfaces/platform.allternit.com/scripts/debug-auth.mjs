import { chromium } from 'playwright';
const ORIGIN = 'https://platform.allternit.com';
const EMAIL = 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD;
if (!PASSWORD) throw new Error('CLERK_TEST_PASSWORD required');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('request', req => {
  if (req.url().includes('api.allternit.com')) {
    console.log('API REQUEST:', req.method(), req.url());
    console.log('  Authorization:', req.headers()['authorization'] || 'MISSING');
  }
});
page.on('response', async res => {
  if (res.url().includes('api.allternit.com')) {
    const body = await res.text().catch(() => '');
    console.log('API RESPONSE:', res.status(), res.url(), body.slice(0, 200));
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
await browser.close();
