import { test, expect } from '@playwright/test';

test('debug iframe position', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(1000);
  
  // Get all elements and their positions
  const elements = await page.evaluate(() => {
    const results: any[] = [];
    
    const checkEl = (el: Element, depth: number) => {
      if (depth > 10) return;
      
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      
      results.push({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        testId: el.getAttribute('data-testid'),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          display: styles.display,
          position: styles.position,
          width: styles.width,
          height: styles.height,
          flex: styles.flex,
          transform: styles.transform,
          left: styles.left,
          right: styles.right,
          marginLeft: styles.marginLeft,
          marginRight: styles.marginRight,
        }
      });
      
      for (const child of el.children) {
        checkEl(child, depth + 1);
      }
    };
    
    const root = document.querySelector('[data-testid="browser-capsule-enhanced-root"]');
    if (root) {
      checkEl(root, 0);
    }
    
    return results;
  });
  
  console.log('Element tree:');
  elements.forEach((el, i) => {
    const indent = '  '.repeat(i);
    console.log(`${indent}${el.tag}.${el.testId || el.id || el.className?.substring(0, 30)} - rect: ${JSON.stringify(el.rect)}`);
  });
  
  await page.screenshot({ path: 'test-results/iframe-position-debug.png', fullPage: true });
});
