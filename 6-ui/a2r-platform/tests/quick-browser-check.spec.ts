import { test } from '@playwright/test';

test('quick browser check', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check if browser rail item exists
  const browserItem = page.locator('[data-rail-item="browser"]');
  const count = await browserItem.count();
  console.log('Browser rail items found:', count);
  
  if (count > 0) {
    await browserItem.click();
    await page.waitForTimeout(2000);
    
    // Check for empty state
    const emptyStateText = page.locator('text="A2R Browser"');
    const exists = await emptyStateText.count() > 0;
    console.log('Empty state visible:', exists);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/quick-browser-check.png', fullPage: true });
  }
});
