const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-input-stack.png', fullPage: false });
  await browser.close();
  console.log('Screenshot saved to shell-input-stack.png');
})();
