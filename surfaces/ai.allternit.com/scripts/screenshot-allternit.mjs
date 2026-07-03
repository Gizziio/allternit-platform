import { chromium } from '@playwright/test';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function capture(url, filename) {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`Captured ${filename}`);
  } catch (err) {
    console.error(`Failed to capture ${url}:`, err.message);
  } finally {
    await browser.close();
  }
}

(async () => {
  await capture('http://localhost:3013', '/tmp/allternit-home.png');
})();
