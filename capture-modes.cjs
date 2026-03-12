const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(5000);
  
  // Click on the Modes button
  const modesButton = await page.locator('button:has-text("Modes")').first();
  if (await modesButton.isVisible().catch(() => false)) {
    await modesButton.click();
    await page.waitForTimeout(1000);
    
    // Click on a mode (Research)
    const researchMode = await page.locator('text=Research').first();
    if (await researchMode.isVisible().catch(() => false)) {
      await researchMode.click();
      await page.waitForTimeout(500);
    }
    
    // Click on another mode (Code)
    const codeMode = await page.locator('text=Code').first();
    if (await codeMode.isVisible().catch(() => false)) {
      await codeMode.click();
      await page.waitForTimeout(500);
    }
  }
  
  await page.screenshot({ path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/shell-modes-selected.png', fullPage: false });
  await browser.close();
  console.log('Screenshot saved');
})();
