import { chromium } from '@playwright/test';
import fs from 'fs';

const email = process.env.ALLTERNIT_TEST_EMAIL ?? 'cartlidge.joseph@proton.me';
const url = 'https://platform.allternit.com/sign-in';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const page = await context.newPage();

page.on('request', req => {
  if (req.url().includes('clerk') || req.url().includes('accounts')) {
    console.log('REQ:', req.method(), req.url());
  }
});
page.on('response', async res => {
  if (res.url().includes('clerk') || res.url().includes('accounts')) {
    console.log('RES:', res.status(), res.url());
  }
});
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
page.on('framenavigated', frame => console.log('NAV:', frame.url()));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator('input[name="identifier"]').first();
  await emailInput.fill(email);
  await page.screenshot({ path: '/tmp/debug2-email-filled.png', fullPage: true });

  // Use Enter key instead of clicking button
  await emailInput.press('Enter');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/debug2-after-enter-2s.png', fullPage: true });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/debug2-after-enter-5s.png', fullPage: true });

  // Try clicking Continue button
  await page.locator('button.cl-formButtonPrimary').filter({ hasText: 'Continue' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/debug2-after-click-2s.png', fullPage: true });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/debug2-after-click-5s.png', fullPage: true });

  console.log('Final URL:', page.url());
} catch (e) {
  console.error('error:', e.message);
} finally {
  await browser.close();
}
