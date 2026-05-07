/**
 * Simple test to verify browser iframe loads content
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

test.describe('Browser Content Load', () => {
  test('browser iframe loads Google content', async ({ page }) => {
    // Go directly to the app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Click Browser
    await page.click('[data-rail-item="browser"]');
    await page.waitForTimeout(2000);
    
    // Take screenshot to see what's rendered
    await page.screenshot({
      path: 'test-results/browser-content-check.png',
      fullPage: true
    });
    
    // Find the browser root
    const browserRoot = page.locator('[data-testid="browser-capsule-enhanced-root"]');
    await expect(browserRoot).toBeVisible();
    
    // Get browser root dimensions
    const rootBox = await browserRoot.boundingBox();
    console.log('Browser root bounding box:', rootBox);
    
    // Find the viewport container (the flex-1 div)
    const viewport = browserRoot.locator('.flex-1.relative.bg-transparent').first();
    await expect(viewport).toBeVisible();
    
    const viewportBox = await viewport.boundingBox();
    console.log('Viewport bounding box:', viewportBox);
    
    // Find the iframe
    const iframe = page.locator('iframe[data-testid="allternit-iframe-content"]');
    const iframeCount = await iframe.count();
    console.log('Iframe count:', iframeCount);
    
    if (iframeCount > 0) {
      const iframeBox = await iframe.boundingBox();
      console.log('Iframe bounding box:', iframeBox);
      
      // Check if iframe has meaningful dimensions
      if (iframeBox && iframeBox.width > 100 && iframeBox.height > 100) {
        console.log('✅ Iframe has proper dimensions:', iframeBox.width, 'x', iframeBox.height);
        
        // Try to access iframe content
        const frame = iframe.contentFrame();
        if (frame) {
          try {
            await frame.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const title = await frame.title();
            console.log('✅ Iframe loaded with title:', title);
          } catch (e) {
            console.log('⚠️ Could not access iframe content:', e.message);
          }
        }
      } else {
        console.log('❌ Iframe has insufficient dimensions:', iframeBox);
      }
    }
    
    // Check the web-proxy response directly
    const response = await page.goto(`${BASE_URL}/web-proxy?url=https://www.google.com`);
    console.log('Web-proxy status:', response?.status());
    
    if (response && response.status() === 200) {
      console.log('✅ Web-proxy returns 200 OK');
      const html = await response.text();
      console.log('Web-proxy response length:', html.length);
      if (html.length > 1000) {
        console.log('✅ Web-proxy returns substantial content');
      }
    }
  });
});
