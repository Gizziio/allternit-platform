import { test } from '@playwright/test';

test('check flex direction', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  const rootStyles = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="browser-capsule-enhanced-root"]');
    if (!root) return null;
    const styles = window.getComputedStyle(root);
    return {
      display: styles.display,
      flexDirection: styles.flexDirection,
      flexWrap: styles.flexWrap,
      flex: styles.flex,
      class: (root as HTMLElement).className,
    };
  });
  
  console.log('Root flex styles:', rootStyles);
});
