import { test } from '@playwright/test';

test('check siblings of viewport', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  const info = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="browser-capsule-enhanced-root"]');
    if (!root) return null;
    
    const children = [];
    for (const child of root.children) {
      const rect = child.getBoundingClientRect();
      const styles = window.getComputedStyle(child);
      children.push({
        tag: child.tagName,
        class: (child as HTMLElement).className?.substring(0, 50),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: styles.display,
        position: styles.position,
        float: styles.float,
      });
    }
    return children;
  });
  
  console.log('Root children (siblings):');
  info?.forEach((child, i) => {
    console.log(`${i}: ${child.tag}.${child.class} - rect: ${JSON.stringify(child.rect)} display:${child.display} position:${child.position}`);
  });
});
