const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(5000);
  
  // Click on Agent Off to enable Agent Mode
  const agentToggle = await page.locator('button:has-text("Agent Off")').first();
  if (await agentToggle.isVisible().catch(() => false)) {
    await agentToggle.click();
    await page.waitForTimeout(3000);
  }
  
  // Press Escape to close any modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Click on Slides tab
  const slidesTab = await page.locator('button:has-text("Slides")').first();
  if (await slidesTab.isVisible().catch(() => false)) {
    await slidesTab.click();
    await page.waitForTimeout(1000);
  }
  
  await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-slides-mode.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved');
})();
