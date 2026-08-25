import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', msg => console.log('PLATFORM:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PLATFORM ERROR:', err.message));
try {
  await page.goto('https://platform.allternit.com/sign-in', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const formInputs = await page.locator('input[type="email"], input[name="identifier"]').count();
  console.log('platform sign-in form inputs:', formInputs);
  await page.screenshot({ path: '/tmp/platform-sign-in-final.png', fullPage: true });
} catch (e) {
  console.error('platform error:', e.message);
  await page.screenshot({ path: '/tmp/platform-sign-in-final-error.png', fullPage: true });
} finally {
  await browser.close();
}

const browser2 = await chromium.launch();
const page2 = await browser2.newPage({ viewport: { width: 1280, height: 720 } });
page2.on('console', msg => console.log('DASHBOARD:', msg.type(), msg.text()));
page2.on('pageerror', err => console.log('DASHBOARD ERROR:', err.message));
try {
  await page2.goto('https://remotecontrol.allternit.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page2.waitForTimeout(5000);
  const signInButton = await page2.locator('text=Sign in with Allternit').count();
  const loading = await page2.locator('text=Loading account').count();
  console.log('dashboard sign-in button:', signInButton, 'loading:', loading);
  await page2.screenshot({ path: '/tmp/remotecontrol-final.png', fullPage: true });
} catch (e) {
  console.error('dashboard error:', e.message);
  await page2.screenshot({ path: '/tmp/remotecontrol-final-error.png', fullPage: true });
} finally {
  await browser2.close();
}
