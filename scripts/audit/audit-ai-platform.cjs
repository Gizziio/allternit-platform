const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });

  try {
    await page.goto('http://127.0.0.1:3013/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/ai-platform-render.png', fullPage: true });
    console.log('Screenshot saved to /tmp/ai-platform-render.png');
    console.log('Console/page errors:', JSON.stringify(errors, null, 2));
  } catch (e) {
    console.log('Navigation error:', e.message);
    console.log('Errors so far:', JSON.stringify(errors, null, 2));
  }

  await browser.close();
})();
