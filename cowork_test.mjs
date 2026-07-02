import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', msg => {
  const txt = msg.text();
  if (msg.type() === 'error') errors.push(`[console.error] ${txt}`);
});
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));
page.on('response', async resp => {
  if (!resp.ok() && resp.url().includes('localhost')) {
    let body = '';
    try { body = (await resp.text()).slice(0, 400); } catch {}
    errors.push(`[http-${resp.status()}] ${resp.url()} — ${body}`);
  }
});

await page.goto('http://localhost:3013', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  localStorage.setItem('allternit-active-mode', 'cowork');
  window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'cowork' } }));
});
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/cowork_1_initial.png' });
console.log('📸 initial state');

const input = page.locator('textarea').first();
const inputVisible = await input.isVisible().catch(() => false);
console.log('textarea visible:', inputVisible);

if (inputVisible) {
  await input.click();
  await input.fill('Write a bash script that lists files');
  await page.keyboard.press('Enter');
  console.log('message sent');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/cowork_2_sent.png' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/cowork_3_response.png' });
} else {
  const text = await page.locator('body').innerText().catch(() => '');
  console.log('body text:', text.slice(0, 600));
}

console.log('\n=== ERRORS ===');
if (!errors.length) console.log('none');
errors.forEach(e => console.log(e));
await browser.close();
