import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

// Collect console logs
const logs = [];
page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));
page.on('response', async res => {
  if (res.url().includes('agent-sessions')) {
    const status = res.status();
    const body = await res.text().catch(() => '[]');
    logs.push({ type: 'api', text: `agent-sessions ${status}: ${body.slice(0, 200)}` });
  }
});

console.log('Opening frontend...');
await page.goto('http://localhost:3013');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// Set mode to 'code' in localStorage and reload
console.log('Switching to Code Mode...');
await page.evaluate(() => {
  localStorage.setItem('allternit-platform-mode', 'code');
});
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(8000);

await page.screenshot({ path: '/tmp/code-mode-v3.png', fullPage: true });

console.log('Console logs:');
for (const log of logs) {
  console.log(`[${log.type}] ${log.text}`);
}

await browser.close();
console.log('Done');
