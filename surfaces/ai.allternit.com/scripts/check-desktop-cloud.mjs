import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
try {
  const resp = await page.goto('http://localhost:3014', { waitUntil: 'load', timeout: 30000 });
  console.log('Page load status:', resp?.status());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/desktop-cloud-landing.png', fullPage: false });
  const desktopCloudBtn = page.locator('text=Desktop Cloud');
  if (await desktopCloudBtn.count() > 0) {
    await desktopCloudBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/desktop-cloud-view.png', fullPage: false });
    console.log('Desktop Cloud view screenshot saved');
  } else {
    console.log('Desktop Cloud button not found');
    const html = await page.content();
    console.log('HTML snippet:', html.slice(0, 500));
  }
} catch (err) {
  console.error('Error:', err.message);
  await page.screenshot({ path: '/tmp/desktop-cloud-error.png', fullPage: false });
} finally {
  await browser.close();
}
