const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:3013', { waitUntil: 'networkidle', timeout: 30000 });
    const composer = page.locator('textarea[placeholder*="brewing"], textarea[placeholder*="help you"]').first();
    await composer.waitFor({ timeout: 15000 });
    await composer.fill('Hello from visual test');
    await composer.press('Enter');
    await page.locator('text=echo brain').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/allternit-chat-visual.png', fullPage: false });
    console.log('Screenshot saved to /tmp/allternit-chat-visual.png');
  } catch (err) {
    console.error('Visual test failed:', err.message);
    await page.screenshot({ path: '/tmp/allternit-chat-visual-error.png', fullPage: false });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
