import { test } from '@playwright/test';

test('find shell entry point', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/landing-page.png', fullPage: true });
  
  // Look for Browser button
  const browserBtn = page.locator('text=Browser');
  const count = await browserBtn.count();
  console.log('Browser buttons found:', count);
  
  if (count > 0) {
    await browserBtn.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/after-browser-click.png', fullPage: true });
  }
  
  // Look for any button
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log('Total buttons:', btnCount);
  
  for (let i = 0; i < Math.min(btnCount, 10); i++) {
    const text = await buttons.nth(i).textContent();
    console.log(`Button ${i}:`, text?.trim());
  }
});
