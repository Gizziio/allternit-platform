import { test, expect } from '@playwright/test';

test('check empty browser state', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  // Check if there's a close button on tabs
  const closeButtons = page.locator('button:has(svg[aria-label="Close"]), button:has(.w-2\\.5)');
  const count = await closeButtons.count();
  console.log('Found', count, 'close buttons');
  
  // Try to close all tabs
  for (let i = 0; i < count && i < 5; i++) {
    try {
      await closeButtons.first().click();
      await page.waitForTimeout(500);
    } catch (e) {
      break;
    }
  }
  
  // Take screenshot of empty state
  await page.screenshot({ path: 'test-results/empty-browser-state.png', fullPage: true });
  
  // Check what's visible
  const browserRoot = page.locator('[data-testid="browser-capsule-enhanced-root"]');
  const isVisible = await browserRoot.isVisible();
  console.log('Browser root visible:', isVisible);
  
  // Check for iframe
  const iframe = page.locator('iframe');
  const iframeCount = await iframe.count();
  console.log('Iframe count:', iframeCount);
  
  // Check for any "new tab" or "empty state" content
  const emptyState = page.locator('text="New Tab"');
  const hasEmptyState = await emptyState.count() > 0;
  console.log('Has empty state:', hasEmptyState);
});
