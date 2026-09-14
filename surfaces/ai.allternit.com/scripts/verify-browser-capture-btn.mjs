import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];
if (!page) { console.error('No page'); process.exit(1); }

await page.goto('http://localhost:3013/shell?view=aci');
await page.waitForTimeout(1500);

// Ensure ACI view is active by clicking the ACI tab if landing is shown
const aciTab = page.locator('button', { hasText: 'ACI' }).first();
if (await aciTab.isVisible().catch(() => false)) {
  await aciTab.click();
  await page.waitForTimeout(800);
}

// Open a web tab so the browser chrome renders the capture button
const googleShortcut = page.locator('button', { hasText: 'Google' }).first();
if (await googleShortcut.isVisible().catch(() => false)) {
  await googleShortcut.click();
  await page.waitForTimeout(1200);
}

const btn = page.locator('[data-testid="browser-api-capture-btn"]').first();
const visible = await btn.isVisible().catch(() => false);
console.log('capture_btn_visible:', visible);

if (visible) {
  await btn.click();
  await page.waitForTimeout(300);
  const menuOpen = await page.locator('text=Site API Capture').first().isVisible().catch(() => false);
  console.log('menu_open:', menuOpen);
  if (menuOpen) {
    const uploadVisible = await page.locator('text=Upload HAR file').first().isVisible().catch(() => false);
    const openVisible = await page.locator('text=Open Site APIs').first().isVisible().catch(() => false);
    console.log('upload_item_visible:', uploadVisible);
    console.log('open_site_apis_visible:', openVisible);
  }
}

await browser.close();
