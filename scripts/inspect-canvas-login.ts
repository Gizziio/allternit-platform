import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://canvas.instructure.com/login');
  await page.waitForLoadState('networkidle');
  const html = await page.content();
  console.log(html);
  await browser.close();
})();
