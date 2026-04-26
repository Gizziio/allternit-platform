import { test, expect } from '@playwright/test';

test('check iframe in DOM', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  // Find iframe directly
  const iframe = page.locator('iframe[data-testid="allternit-iframe-content"]');
  const count = await iframe.count();
  console.log('Iframe count:', count);
  
  if (count > 0) {
    // Get iframe's parent chain
    const parentInfo = await page.evaluate(() => {
      const iframeEl = document.querySelector('iframe[data-testid="allternit-iframe-content"]');
      if (!iframeEl) return null;
      
      const chain = [];
      let el: Element | null = iframeEl;
      while (el && chain.length < 15) {
        chain.push({
          tag: el.tagName,
          testId: el.getAttribute('data-testid'),
          className: (el as HTMLElement).className?.substring(0, 50),
          style: (el as HTMLElement).style.cssText.substring(0, 100),
          rect: el.getBoundingClientRect(),
        });
        el = el.parentElement;
      }
      return chain;
    });
    
    console.log('Iframe parent chain (from iframe up):');
    parentInfo?.forEach((item, i) => {
      console.log(`  ${i}: ${item.tag} testId=${item.testId} rect=${JSON.stringify(item.rect)}`);
    });
  }
  
  await page.screenshot({ path: 'test-results/iframe-dom-check.png', fullPage: true });
});
