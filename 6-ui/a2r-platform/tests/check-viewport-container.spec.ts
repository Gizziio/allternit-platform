import { test } from '@playwright/test';

test('check viewport container', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(2000);
  
  const parentInfo = await page.evaluate(() => {
    const iframeEl = document.querySelector('iframe[data-testid="a2r-iframe-content"]');
    if (!iframeEl) return null;
    
    const chain = [];
    let el: Element | null = iframeEl;
    while (el && chain.length < 10) {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        class: (el as HTMLElement).className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        computedStyles: {
          width: styles.width,
          height: styles.height,
          display: styles.display,
          flex: styles.flex,
          position: styles.position,
          left: styles.left,
          right: styles.right,
          transform: styles.transform,
          float: styles.float,
          clear: styles.clear,
        },
      });
      el = el.parentElement;
    }
    return chain;
  });
  
  console.log('Full parent chain:');
  parentInfo?.forEach((item, i) => {
    console.log(`\n${i}: ${item.tag}.${item.testId || item.class.substring(0, 40)}`);
    console.log(`   rect: ${JSON.stringify(item.rect)}`);
    console.log(`   styles: ${JSON.stringify(item.computedStyles)}`);
  });
});
