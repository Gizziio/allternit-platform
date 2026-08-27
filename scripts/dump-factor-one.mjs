import { chromium } from 'playwright';
const email = process.env.ALLTERNIT_TEST_EMAIL;
if (!email) { console.error('Set ALLTERNIT_TEST_EMAIL'); process.exit(1); }
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) console.log('[navigate]', frame.url()); });
await page.goto('https://platform.allternit.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
await page.locator('input[name="identifier"]').first().fill(email);
await page.getByRole('button', { name: /^Continue$/i }).click();
await page.waitForTimeout(3000);
const html = await page.content();
const inputs = await page.locator('input, button').evaluateAll(els => els.map(e => ({ tag: e.tagName, type: e.type, name: e.name, placeholder: e.placeholder, text: e.textContent?.slice(0, 50), classes: e.className?.slice(0, 100) })));
console.log('URL:', page.url());
console.log('INPUTS/BUTTONS:', JSON.stringify(inputs, null, 2));
await page.screenshot({ path: '/tmp/factor-one.png', fullPage: false });
await browser.close();
