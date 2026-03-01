import { test } from '@playwright/test';

test('check parent styles', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  const parentInfo = await page.evaluate(() => {
    const iframeEl = document.querySelector('iframe[data-testid="a2r-iframe-content"]');
    if (!iframeEl) return null;
    
    const chain = [];
    let el: Element | null = iframeEl;
    while (el && chain.length < 6) {
      const styles = window.getComputedStyle(el);
      chain.push({
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        rect: el.getBoundingClientRect(),
        computedStyles: {
          width: styles.width,
          height: styles.height,
          display: styles.display,
          flex: styles.flex,
          minWidth: styles.minWidth,
          maxWidth: styles.maxWidth,
          position: styles.position,
          float: styles.float,
        },
        inlineStyle: (el as HTMLElement).style.cssText,
      });
      el = el.parentElement;
    }
    return chain;
  });
  
  console.log('Parent chain details:');
  parentInfo?.forEach((item, i) => {
    console.log(`\n=== Level ${i}: ${item.tag} (testId: ${item.testId}) ===`);
    console.log('Rect:', item.rect);
    console.log('Computed:', item.computedStyles);
    console.log('Inline:', item.inlineStyle);
  });
});
