import { test } from '@playwright/test';

test('show empty state', async ({ page }) => {
  // Navigate to browser
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  
  // Click browser
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(1000);
  
  // Close the tab
  const closeBtn = page.locator('button:has(.w-2\\.5)').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
  
  // Take screenshot immediately before auto-tab creates
  await page.screenshot({ path: 'test-results/empty-state-showing.png', fullPage: true });
  
  // Wait a bit for auto-tab
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/after-auto-tab.png', fullPage: true });
});
