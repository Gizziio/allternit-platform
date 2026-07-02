import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

console.log('Opening frontend...');
await page.goto('http://localhost:3013');
await page.waitForTimeout(3000);

// Set mode to 'code' in localStorage and reload
console.log('Switching to Code Mode...');
await page.evaluate(() => {
  localStorage.setItem('allternit-platform-mode', 'code');
});
await page.reload();
await page.waitForTimeout(8000);

await page.screenshot({ path: '/tmp/code-mode-v4.png', fullPage: true });
console.log('Screenshot saved: /tmp/code-mode-v4.png');

await browser.close();
console.log('Done');
