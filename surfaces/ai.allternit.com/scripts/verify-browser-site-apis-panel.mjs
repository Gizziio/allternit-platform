import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];
if (!page) { console.error('No page'); process.exit(1); }

await page.goto('http://localhost:3013/shell?view=aci');
await page.waitForTimeout(1500);

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

const captureBtn = page.locator('[data-testid="browser-api-capture-btn"]').first();
console.log('capture_btn_visible:', await captureBtn.isVisible().catch(() => false));

// Open agent chat pane via the matrix/agent button if not already open
const agentBtn = page.locator('button[title="Allternit Computer Agent — right-click for controls"]').first();
if (await agentBtn.isVisible().catch(() => false)) {
  await agentBtn.click();
  await page.waitForTimeout(500);
}

// Check agent pane tabs
const siteApisTab = page.locator('button', { hasText: 'Site APIs' }).first();
console.log('agent_pane_site_apis_tab_visible:', await siteApisTab.isVisible().catch(() => false));

if (await siteApisTab.isVisible().catch(() => false)) {
  await siteApisTab.click();
  await page.waitForTimeout(500);
  console.log('site_apis_view_visible:', await page.locator('text=Site APIs').first().isVisible().catch(() => false));
  console.log('capture_sessions_section_visible:', await page.locator('text=Capture Sessions').first().isVisible().catch(() => false));
}

await browser.close();
