const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(5000);
  
  // Click on the input area to focus it
  const input = await page.locator('textarea[placeholder*="What"]').first();
  if (await input.isVisible().catch(() => false)) {
    await input.click();
    await page.waitForTimeout(1000);
  }
  
  await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-focus.png', fullPage: false });
  await browser.close();
  console.log('Screenshot saved');
})();
