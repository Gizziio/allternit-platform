import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
try {
  const resp = await page.goto('http://127.0.0.1:3020/desktop-cloud-demo.html', { waitUntil: 'load', timeout: 30000 });
  console.log('Page load status:', resp?.status());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/desktop-cloud-demo.png', fullPage: false });
  const title = await page.textContent('h1');
  console.log('Title:', title);
} catch (err) {
  console.error('Error:', err.message);
  await page.screenshot({ path: '/tmp/desktop-cloud-demo-error.png', fullPage: false });
} finally {
  await browser.close();
}
