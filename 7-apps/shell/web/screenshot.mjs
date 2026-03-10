import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:5177');
const context = browser.contexts()[0];
const page = context.pages()[0];
await page.screenshot({ path: '/Users/macbook/screenshot.png', fullPage: true });
await browser.close();
console.log('Screenshot saved to /Users/macbook/screenshot.png');
