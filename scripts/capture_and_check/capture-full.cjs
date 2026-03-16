const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(6000);
  
  // Scroll to bottom to see full input
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-input-full.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved');
})();
