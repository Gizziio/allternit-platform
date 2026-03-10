import { chromium } from 'playwright';
const browser = await chromium.launch({ 
  headless: false,
  args: ['--remote-debugging-port=9222']
});
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
await page.goto('http://localhost:5177');
await page.waitForTimeout(4000);
await page.click('[data-item-id="agent-hub"]');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/macbook/agent_hub_current.png' });
await browser.close();
