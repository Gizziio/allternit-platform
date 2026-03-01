import { test } from '@playwright/test';

test('initial page check', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Take screenshot of initial page
  await page.screenshot({ path: 'test-results/initial-page.png', fullPage: true });
  
  // Find all rail items
  const railItems = page.locator('[data-rail-item]');
  const count = await railItems.count();
  console.log('Total rail items:', count);
  
  for (let i = 0; i < count && i < 10; i++) {
    const item = railItems.nth(i);
    const text = await item.textContent();
    console.log(`Rail item ${i}:`, text?.trim());
  }
});
