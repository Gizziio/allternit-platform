import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5177';

test('check browser store state', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  
  // Check browser store before clicking browser
  let browserStore = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__BROWSER_STORE__;
    return store ? store.getState() : null;
  });
  console.log('Browser store before:', browserStore);
  
  // Click Browser
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  // Check browser store after
  browserStore = await page.evaluate(() => {
    // @ts-ignore
    const store = window.__BROWSER_STORE__;
    return store ? store.getState() : null;
  });
  console.log('Browser store after:', browserStore);
  
  // Check DOM for browser component
  const browserRoot = page.locator('[data-testid="browser-capsule-enhanced-root"]');
  const isVisible = await browserRoot.isVisible();
  console.log('Browser root visible:', isVisible);
  
  // Get all iframes
  const iframes = page.locator('iframe');
  const iframeCount = await iframes.count();
  console.log('Total iframes:', iframeCount);
  
  for (let i = 0; i < iframeCount; i++) {
    const iframe = iframes.nth(i);
    const src = await iframe.getAttribute('src');
    const testId = await iframe.getAttribute('data-testid');
    const style = await iframe.getAttribute('style');
    const className = await iframe.getAttribute('class');
    const box = await iframe.boundingBox();
    
    console.log(`Iframe ${i}:`, { src, testId, className, style, box });
  }
  
  // Get computed style of browser root
  const browserStyle = await browserRoot.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      width: styles.width,
      height: styles.height,
      display: styles.display,
      visibility: styles.visibility,
      position: styles.position,
      flex: styles.flex,
      minHeight: styles.minHeight,
      maxHeight: styles.maxHeight
    };
  });
  console.log('Browser root computed styles:', browserStyle);
  
  // Get computed style of viewport container
  const viewport = page.locator('[data-testid="browser-capsule-enhanced-root"] > div').nth(2);
  const viewportStyle = await viewport.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      width: styles.width,
      height: styles.height,
      display: styles.display,
      flex: styles.flex
    };
  });
  console.log('Viewport computed styles:', viewportStyle);
  
  await page.screenshot({ path: 'test-results/browser-state-check.png', fullPage: true });
});
