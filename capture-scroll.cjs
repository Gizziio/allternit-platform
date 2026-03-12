const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(5000);
  
  // Take screenshot of just the input area region
  const inputBox = await page.locator('.w-full.rounded-2xl').first();
  if (await inputBox.isVisible().catch(() => false)) {
    const box = await inputBox.boundingBox();
    await page.screenshot({ 
      path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-input-region.png',
      clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 }
    });
  } else {
    await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-input-region.png' });
  }
  
  await browser.close();
  console.log('Screenshot saved');
})();
