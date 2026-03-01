import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5177';

test('check layout dimensions', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(1000);
  
  // Check shell frame
  const shellFrame = page.locator('[style*="grid-template-columns"]');
  const shellFrameBox = await shellFrame.boundingBox();
  console.log('ShellFrame:', shellFrameBox);
  
  // Check canvas container (grid column 2)
  const canvasContainer = page.locator('[style*="grid-column: 2"]').first();
  const canvasBox = await canvasContainer.boundingBox();
  console.log('Canvas container:', canvasBox);
  
  // Check ShellCanvas
  const shellCanvas = page.locator('[data-shell-canvas]');
  const shellCanvasBox = await shellCanvas.boundingBox();
  console.log('ShellCanvas:', shellCanvasBox);
  
  // Check view-host-wrapper
  const viewHost = page.locator('[data-testid="view-host-wrapper"]');
  const viewHostBox = await viewHost.boundingBox();
  console.log('ViewHost:', viewHostBox);
  
  // Check browser root
  const browserRoot = page.locator('[data-testid="browser-capsule-enhanced-root"]');
  const browserRootBox = await browserRoot.boundingBox();
  console.log('BrowserCapsuleEnhanced:', browserRootBox);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/layout-check.png', fullPage: true });
});
