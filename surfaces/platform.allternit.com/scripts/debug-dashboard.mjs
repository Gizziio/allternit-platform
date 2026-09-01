#!/usr/bin/env node
import { chromium } from 'playwright';

const ORIGIN = 'https://platform.allternit.com';
const EMAIL = 'cartlidge.joseph@yahoo.com';
const PASSWORD = process.env.CLERK_TEST_PASSWORD || '';

if (!PASSWORD) {
  console.error('CLERK_TEST_PASSWORD required');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

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

console.log('Signed in. Waiting for API calls...');
await page.waitForTimeout(25000);

const text = await page.evaluate(() => document.body.innerText);
const hasSkeleton = await page.evaluate(() => document.querySelectorAll('.animate-pulse').length);
console.log('Has skeletons:', hasSkeleton);
console.log('Body text snippet:', text.slice(0, 2000));

await browser.close();
