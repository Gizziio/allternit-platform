/**
 * Debug script to trace ShellAppInner re-rendering issue
 * 
 * Run with: npx playwright test tests/debug-nav-rendering.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

test.describe('Navigation Re-rendering Debug', () => {
  test('trace nav state changes when clicking Browser tab', async ({ page }) => {
    // Set up console listener BEFORE navigating
    const consoleLogs: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      // Capture only our debug logs
      if (text.includes('ShellAppInner:') || 
          text.includes('navReducer:') || 
          text.includes('ViewHost:') ||
          text.includes('selectActiveView:') ||
          text.includes('open()')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
        console.log(`[${msg.type()}] ${text}`);
      }
    });

    // Navigate to app
    console.log('Navigating to', BASE_URL);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for initial render
    
    console.log('\n=== Initial render complete ===\n');
    
    // Click Browser tab
    console.log('Clicking Browser tab...');
    const browserItem = page.locator('[data-rail-item="browser"]');
    
    if (await browserItem.count() === 0) {
      console.log('Browser rail item not found, looking for alternative selectors...');
      // Try to find any rail item
      const railItems = page.locator('[data-rail-item]');
      const count = await railItems.count();
      console.log(`Found ${count} rail items`);
      
      for (let i = 0; i < count; i++) {
        const item = railItems.nth(i);
        const text = await item.textContent();
        console.log(`  Rail item ${i}: ${text?.trim()}`);
      }
    }
    
    await browserItem.click();
    await page.waitForTimeout(500);
    
    console.log('\n=== After clicking Browser tab ===\n');
    
    // Check what view is currently active
    const viewHostWrapper = page.locator('[data-testid="view-host-wrapper"]');
    if (await viewHostWrapper.count() > 0) {
      const activeView = await viewHostWrapper.getAttribute('data-active-view');
      console.log(`ViewHost wrapper data-active-view: ${activeView}`);
    } else {
      console.log('ViewHost wrapper NOT found');
    }

    // Check for browser-specific elements
    const browserCapsule = page.locator('[data-browser-capsule]');
    const browserEnhanced = page.locator('[data-testid="browser-capsule-enhanced-root"]');
    const iframe = page.locator('iframe');
    const webview = page.locator('webview');
    const a2rWebview = page.locator('[data-testid="a2r-webview-content"]');
    const a2rIframe = page.locator('[data-testid="a2r-iframe-content"]');

    console.log(`Browser capsule (old) found: ${await browserCapsule.count()}`);
    console.log(`BrowserCapsuleEnhanced root found: ${await browserEnhanced.count()}`);
    console.log(`iframe found: ${await iframe.count()}`);
    console.log(`webview found: ${await webview.count()}`);
    console.log(`a2r-webview-content found: ${await a2rWebview.count()}`);
    console.log(`a2r-iframe-content found: ${await a2rIframe.count()}`);

    // Get details about what's actually rendered
    if (await viewHostWrapper.count() > 0) {
      const innerHTML = await viewHostWrapper.innerHTML();
      console.log('ViewHost wrapper innerHTML (first 800 chars):', innerHTML.substring(0, 800));

      // Get the direct children
      const children = await viewHostWrapper.locator('> *').all();
      console.log(`ViewHost has ${children.length} direct children`);
      for (let i = 0; i < Math.min(children.length, 3); i++) {
        const tagName = await children[i].evaluate(el => el.tagName);
        const className = await children[i].getAttribute('class');
        const testId = await children[i].getAttribute('data-testid');
        console.log(`  Child ${i}: <${tagName}> class="${className}" data-testid="${testId}"`);
      }
    }
    
    // Take screenshot
    await page.screenshot({
      path: 'test-results/debug-browser-view.png',
      fullPage: true
    });
    
    // Write console logs to file using Playwright's fs import
    const { writeFileSync } = await import('fs');
    writeFileSync(
      'test-results/console-debug-logs.txt',
      consoleLogs.join('\n')
    );
    console.log('\nConsole logs written to test-results/console-debug-logs.txt');
    
    // Assert that we expect to see certain logs
    expect(consoleLogs.some(log => log.includes('open() called'))).toBe(true);
    expect(consoleLogs.some(log => log.includes('OPEN_VIEW'))).toBe(true);
  });
});
