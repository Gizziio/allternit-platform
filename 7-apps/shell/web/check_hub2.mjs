import { chromium } from 'playwright';
const browser = await chromium.launch({ 
  headless: false,
  args: ['--remote-debugging-port=9223']
});
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
await page.goto('http://localhost:5177');
await page.waitForTimeout(3000);
// Try clicking by text
await page.click('text=Agent Hub');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/macbook/agent_hub2.png' });
// Now click the dropdown
await page.click('button:has-text("Agent Studio")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/agent_hub_dropdown.png' });
await browser.close();
