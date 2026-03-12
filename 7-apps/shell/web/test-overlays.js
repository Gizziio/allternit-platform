import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  await page.goto('http://127.0.0.1:5177/');
  await page.waitForTimeout(3000);
  
  // Test 1: Browse All Models Overlay
  console.log('Testing Browse All Models overlay...');
  await page.locator('text=Big Pickle').first().click();
  await page.waitForTimeout(800);
  
  await page.locator('button:has-text("Browse all models")').first().click();
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/tmp/browse-all-models-final.png' });
  console.log('Screenshot 1 saved to /tmp/browse-all-models-final.png');
  
  // Close the overlay
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Test 2: Connect Provider Overlay
  console.log('Testing Connect Provider overlay...');
  await page.locator('text=Big Pickle').first().click();
  await page.waitForTimeout(800);
  
  await page.locator('button:has-text("Connect provider")').first().click();
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/tmp/connect-provider-final.png' });
  console.log('Screenshot 2 saved to /tmp/connect-provider-final.png');
  
  await browser.close();
  console.log('Done!');
})();
